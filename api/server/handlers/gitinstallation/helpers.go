package gitinstallation

import (
	"net/http"
	"net/url"

	"github.com/bradleyfalzon/ghinstallation"
	"github.com/google/go-github/github"
	"github.com/porter-dev/porter/api/server/handlers"
	"github.com/porter-dev/porter/api/server/shared/apierrors"
	"github.com/porter-dev/porter/api/server/shared/config"
	"github.com/porter-dev/porter/api/server/shared/requestutils"
	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/internal/models"
	"github.com/porter-dev/porter/internal/models/integrations"
	"github.com/porter-dev/porter/internal/oauth"
	"golang.org/x/oauth2"
)

// GetGithubAppOauthTokenFromRequest gets the GH oauth token from the request based on the currently
// logged in user
func GetGithubAppOauthTokenFromRequest(config *config.Config, r *http.Request) (*oauth2.Token, error) {
	// read the user from context
	user, _ := r.Context().Value(types.UserScope).(*models.User)

	getOAuthInt := config.Repo.GithubAppOAuthIntegration().ReadGithubAppOauthIntegration
	oauthInt, err := getOAuthInt(user.GithubAppIntegrationID)

	if err != nil {
		return nil, err
	}

	_, _, err = oauth.GetAccessToken(oauthInt.SharedOAuthModel,
		&config.GithubAppConf.Config,
		oauth.MakeUpdateGithubAppOauthIntegrationFunction(oauthInt, config.Repo),
	)

	if err != nil {
		// try again, in case the token got updated
		oauthInt2, err := getOAuthInt(user.GithubAppIntegrationID)

		if err != nil || oauthInt2.Expiry == oauthInt.Expiry {
			return nil, err
		}
		oauthInt.AccessToken = oauthInt2.AccessToken
		oauthInt.RefreshToken = oauthInt2.RefreshToken
		oauthInt.Expiry = oauthInt2.Expiry
	}

	return &oauth2.Token{
		AccessToken:  string(oauthInt.AccessToken),
		RefreshToken: string(oauthInt.RefreshToken),
		Expiry:       oauthInt.Expiry,
		TokenType:    "Bearer",
	}, nil
}

// GetGithubAppClientFromRequest gets the github app installation id from the request and authenticates
// using it and a private key file
func GetGithubAppClientFromRequest(config *config.Config, r *http.Request) (*github.Client, error) {
	// get installation id from context
	ga, _ := r.Context().Value(types.GitInstallationScope).(*integrations.GithubAppInstallation)

	itr, err := ghinstallation.NewKeyFromFile(
		http.DefaultTransport,
		config.GithubAppConf.AppID,
		ga.InstallationID,
		config.GithubAppConf.SecretPath,
	)

	if err != nil {
		return nil, err
	}

	return github.NewClient(&http.Client{Transport: itr}), nil
}

// GetOwnerAndNameParams gets the owner and name ref for the Github repo
func GetOwnerAndNameParams(c handlers.PorterHandler, w http.ResponseWriter, r *http.Request) (string, string, bool) {
	owner, reqErr := requestutils.GetURLParamString(r, types.URLParamGitRepoOwner)

	if reqErr != nil {
		c.HandleAPIError(w, r, reqErr)
		return "", "", false
	}

	name, reqErr := requestutils.GetURLParamString(r, types.URLParamGitRepoName)

	if reqErr != nil {
		c.HandleAPIError(w, r, reqErr)
		return "", "", false
	}

	return owner, name, true
}

// GetBranch gets the unencoded branch
func GetBranch(c handlers.PorterHandler, w http.ResponseWriter, r *http.Request) (string, bool) {
	branch, reqErr := requestutils.GetURLParamString(r, types.URLParamGitBranch)

	if reqErr != nil {
		c.HandleAPIError(w, r, reqErr)
		return "", false
	}

	branch, err := url.QueryUnescape(branch)

	if reqErr != nil {
		c.HandleAPIError(w, r, apierrors.NewErrInternal(err))
		return "", false
	}

	return branch, true
}
