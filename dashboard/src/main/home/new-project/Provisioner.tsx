import React, { Component } from 'react';
import styled from 'styled-components';

import api from '../../../shared/api';
import { Context } from '../../../shared/Context';
import { integrationList } from '../../../shared/common';
import loading from '../../../assets/loading.gif';

import Helper from '../../../components/values-form/Helper';
import { eventNames } from 'process';

type PropsType = {
  viewData: any,
  setCurrentView: (x: string) => void,
};

type StateType = {
  logs: string[],
  websockets: any[],
  maxStep : Record<string, number>,
  currentStep: Record<string, number>,
};

export default class Provisioner extends Component<PropsType, StateType> {
  state = {
    logs: [] as string[],
    websockets : [] as any[],
    maxStep: {} as Record<string, any>,
    currentStep: {} as Record<string, number>,
  }

  scrollToBottom = () => {
    this.scrollRef.current.scrollTop = this.scrollRef.current.scrollHeight
  }

  componentDidMount() {
    let { currentProject } = this.context;
    let protocol = process.env.NODE_ENV == 'production' ? 'wss' : 'ws'

    let websockets = this.props.viewData.forEach((infra: any) => {
      let ws = new WebSocket(`${protocol}://${process.env.API_SERVER}/api/projects/${currentProject.id}/provision/${infra.kind}/${infra.infra_id}/logs`)
      
      ws.onopen = () => {
        console.log('connected to websocket')
      }

      ws.onmessage = (evt: MessageEvent) => {
        let event = JSON.parse(evt.data)
        let data = event.map((msg: any) => { return `${infra.kind}: ${msg["Values"]["data"]}` })
        let err = null

        // check for error
        event.forEach((e: any) => {
          err = e["Values"]["kind"] == "error" ? e["Values"]["data"] : null
        })

        if (err) {
          this.setState({ logs: [err] })
        }
        
        if (!this.state.maxStep[infra.kind]) {
          this.setState({
            maxStep: {
              ...this.state.maxStep,
              [infra.kind] : event[event.length]["Values"]["created_resources"]
            }
          })
        }

        this.setState({ 
          logs: [...this.state.logs, ...data], 
          currentStep: {
            ...this.state.currentStep,
            [infra.kind] : event[event.length]["Values"]["created_resources"]
          },
        }, () => {
          this.scrollToBottom()
        })
      }

      ws.onerror = (err: ErrorEvent) => {
        console.log(err)
      }

      ws.onclose = () => {
        console.log('closing provisioner websocket')
      }

      return ws
    });

    this.setState({ websockets, logs: [] });
  }

  componentWillUnmount() {
    this.state.websockets?.forEach((ws) => {
      ws.close()
    })
  }

  scrollRef = React.createRef<HTMLDivElement>();

  renderLogs = () => {
    return this.state.logs.map((log, i) => {
      return <div key={i}>{log}</div>
    });
  }
  
  render() {
    let maxStep = 0;
    let currentStep = 0;

    for (let key in this.state.maxStep) {
      maxStep += this.state.maxStep[key]
    }

    for (let key in this.state.currentStep) {
      currentStep += this.state.currentStep[key]
    }

    if (currentStep === maxStep) {
      this.props.setCurrentView('dashboard');
    }

    return (
      <StyledProvisioner>
        <TitleSection>
          <Title><img src={loading} /> Setting Up Porter</Title>
        </TitleSection>

        <Helper>
          Porter is currently being provisioned to your AWS account:
        </Helper>

        <LoadingBar>
          <Loaded progress={((currentStep / maxStep) * 100).toString() + '%'} />
        </LoadingBar>

        <LogStream ref={this.scrollRef}>
          <Wrapper>
            {this.renderLogs()}
          </Wrapper>
        </LogStream>

        <Helper>
          (Provisioning usually takes around 15 minutes)
        </Helper>
      </StyledProvisioner>
    );
  }
}

Provisioner.contextType = Context;

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px 25px;
`;

const LogStream = styled.div`
  height: 300px;
  margin-top: 30px;
  font-size: 13px;
  border: 2px solid #ffffff55;
  border-radius: 10px;
  width: 100%;
  background: #00000022;
  user-select: text;
`;

const Message = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
  color: #ffffff44;
  font-size: 13px;
`;

const Loaded = styled.div`
  width: ${(props: { progress: string }) => props.progress};
  height: 100%;
  background: linear-gradient(to right, #4f8aff, #8e7dff, #4f8aff);
  background-size: 400% 400%;

  animation: linkLoad 2s infinite;

  @keyframes linkLoad {
    0%{background-position:91% 100%}
    100%{background-position:10% 0%}
  }
`;

const LoadingBar = styled.div`
  width: 100%;
  margin-top: 24px;
  overflow: hidden;
  height: 20px;
  background: #ffffff11;
  border-radius: 30px;
`;

const Title = styled.div`
  font-size: 24px;
  font-weight: 600;
  font-family: 'Work Sans', sans-serif;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  > img {
    width: 20px;
    margin-right: 10px;
    margin-bottom: -2px;
  }
`;

const TitleSection = styled.div`
  margin-bottom: 20px;
  display: flex;
  flex-direction: row;
  align-items: center;

  > a {
    > i {
      display: flex;
      align-items: center;
      margin-bottom: -2px;
      font-size: 18px;
      margin-left: 18px;
      color: #858FAAaa;
      cursor: pointer;
      :hover {
        color: #aaaabb;
      }
    }
  }
`;

const StyledProvisioner = styled.div`
  width: calc(90% - 150px);
  min-width: 300px;
  height: 600px;
  position: relative;
  padding-top: 50px;
  margin-top: calc(50vh - 350px);
`;