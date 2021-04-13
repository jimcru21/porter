import React, { Component } from "react";
import styled from "styled-components";

import { Context } from "shared/Context";
import api from "shared/api";
import { ChartType, StorageType, ClusterType } from "shared/types";
import { PorterUrl } from "shared/routing";

import EnvGroup from "./EnvGroup";
import Loading from "components/Loading";

type PropsType = {
  currentCluster: ClusterType;
  namespace: string;
  sortType: string;
  setExpandedEnvGroup: (envGroup: any) => void;
};

type StateType = {
  envGroups: any[];
  loading: boolean;
  error: boolean;
};

const dummyEnvGroups = [
  { name: "sapporo", last_updated: "12", namespace: "default" },
  { name: "backend-staging", last_updated: "4", namespace: "default" },
  { name: "backend-production", last_updated: "7", namespace: "default" },
];

export default class EnvGroupList extends Component<PropsType, StateType> {
  state = {
    envGroups: dummyEnvGroups as any[],
    loading: false,
    error: false,
  };

  updateEnvGroups = () => {
    // retrieve and set env groups
  };

  componentDidMount() {
    this.updateEnvGroups();
  }

  componentDidUpdate(prevProps: PropsType) {
    // Ret2: Prevents reload when opening ClusterConfigModal
    if (
      prevProps.currentCluster !== this.props.currentCluster ||
      prevProps.namespace !== this.props.namespace ||
      prevProps.sortType !== this.props.sortType
    ) {
      this.updateEnvGroups();
    }
  }

  renderEnvGroupList = () => {
    let { loading, error, envGroups } = this.state;

    if (loading) {
      return (
        <LoadingWrapper>
          <Loading />
        </LoadingWrapper>
      );
    } else if (error) {
      return (
        <Placeholder>
          <i className="material-icons">error</i> Error connecting to cluster.
        </Placeholder>
      );
    } else if (envGroups.length === 0) {
      return (
        <Placeholder>
          <i className="material-icons">category</i>
          No environment groups found in this namespace.
        </Placeholder>
      );
    }

    return this.state.envGroups.map((envGroup: any, i: number) => {
      return (
        <EnvGroup
          key={i}
          envGroup={envGroup}
          setExpanded={() => this.props.setExpandedEnvGroup(envGroup)}
        />
      );
    });
  };

  render() {
    return <StyledEnvGroupList>{this.renderEnvGroupList()}</StyledEnvGroupList>;
  }
}

EnvGroupList.contextType = Context;

const Placeholder = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff44;
  background: #26282f;
  border-radius: 5px;
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff44;
  font-size: 13px;

  > i {
    font-size: 16px;
    margin-right: 12px;
  }
`;

const LoadingWrapper = styled.div`
  padding-top: 100px;
`;

const StyledEnvGroupList = styled.div`
  padding-bottom: 85px;
`;