import React, { type ErrorInfo, type PropsWithChildren } from 'react';

type State={error:string|null};
export default class CrashShield extends React.Component<PropsWithChildren,State>{
  state:State={error:null};
  static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)}}
  componentDidCatch(error:unknown,info:ErrorInfo){console.error('MACROSTATE UI recovered from an error',error,info)}
  render(){
    if(this.state.error)return <div className="crash-card"><div><span className="eyebrow">MACROSTATE SAFETY MODE</span><h1>The command room caught an interface error.</h1><p>{this.state.error}</p><button onClick={()=>{this.setState({error:null});location.reload()}}>Restart interface</button><button onClick={()=>{localStorage.removeItem('macrostate-policy-command-v9');location.reload()}}>Reset V9 save</button></div></div>;
    return this.props.children;
  }
}
