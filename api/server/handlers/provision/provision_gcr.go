package provision

import (
	"net/http"

	"github.com/porter-dev/porter/api/server/handlers"
	"github.com/porter-dev/porter/api/server/shared"
	"github.com/porter-dev/porter/api/server/shared/apierrors"
	"github.com/porter-dev/porter/api/server/shared/config"
	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/internal/analytics"
	"github.com/porter-dev/porter/internal/kubernetes"
	"github.com/porter-dev/porter/internal/kubernetes/provisioner"
	"github.com/porter-dev/porter/internal/models"
	"github.com/porter-dev/porter/internal/repository"
	"gorm.io/gorm"
)

type ProvisionGCRHandler struct {
	handlers.PorterHandlerReadWriter
}

func NewProvisionGCRHandler(
	config *config.Config,
	decoderValidator shared.RequestDecoderValidator,
	writer shared.ResultWriter,
) *ProvisionGCRHandler {
	return &ProvisionGCRHandler{
		PorterHandlerReadWriter: handlers.NewDefaultPorterHandler(config, decoderValidator, writer),
	}
}

func (c *ProvisionGCRHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// read the user and project from context
	user, _ := r.Context().Value(types.UserScope).(*models.User)
	proj, _ := r.Context().Value(types.ProjectScope).(*models.Project)

	request := &types.CreateGCRInfraRequest{
		ProjectID: proj.ID,
	}

	if ok := c.DecodeAndValidate(w, r, request); !ok {
		return
	}

	// get the AWS integration
	gcpInt, err := c.Repo().GCPIntegration().ReadGCPIntegration(proj.ID, request.GCPIntegrationID)

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.HandleAPIError(w, r, apierrors.NewErrForbidden(err))
		} else {
			c.HandleAPIError(w, r, apierrors.NewErrInternal(err))
		}

		return
	}

	suffix, err := repository.GenerateRandomBytes(6)

	if err != nil {
		c.HandleAPIError(w, r, apierrors.NewErrInternal(err))
		return
	}

	infra := &models.Infra{
		Kind:             types.InfraGCR,
		ProjectID:        proj.ID,
		Suffix:           suffix,
		Status:           types.StatusCreating,
		GCPIntegrationID: request.GCPIntegrationID,
		CreatedByUserID:  user.ID,
	}

	// handle write to the database
	infra, err = c.Repo().Infra().CreateInfra(infra)

	if err != nil {
		c.HandleAPIError(w, r, apierrors.NewErrInternal(err))
		return
	}

	// launch provisioning pod
	_, err = c.Config().ProvisionerAgent.ProvisionGCR(
		&kubernetes.SharedProvisionOpts{
			ProjectID:           proj.ID,
			Repo:                c.Repo(),
			Infra:               infra,
			Operation:           provisioner.Apply,
			PGConf:              c.Config().DBConf,
			RedisConf:           c.Config().RedisConf,
			ProvImageTag:        c.Config().ServerConf.ProvisionerImageTag,
			ProvImagePullSecret: c.Config().ServerConf.ProvisionerImagePullSecret,
		},
		gcpInt,
	)

	if err != nil {
		infra.Status = types.StatusError
		infra, _ = c.Repo().Infra().UpdateInfra(infra)
		c.HandleAPIError(w, r, apierrors.NewErrInternal(err))
		return
	}

	c.Config().AnalyticsClient.Track(analytics.RegistryProvisioningStartTrack(
		&analytics.RegistryProvisioningStartTrackOpts{
			ProjectScopedTrackOpts: analytics.GetProjectScopedTrackOpts(user.ID, proj.ID),
			RegistryType:           types.InfraGCR,
			InfraID:                infra.ID,
		},
	))

	c.WriteResult(w, r, infra.ToInfraType())
}
