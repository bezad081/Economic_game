import React from 'react';

type State={error:string|null};
export default class CrashShield extends React.Component<React.PropsWithChildren,State>{
  state:State={error:null};
  static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)}}
  componentDidCatch(error:unknown,info:React.ErrorInfo){console.error('MACROSTATE UI recovered from an error',error,info)}
  render(){
    if(this.state.error) return <div className="crash-shield"><div><span>MACROSTATE SAFETY MODE</span><h1>The interface caught an error instead of going blank.</h1><p>{this.state.error}</p><button onClick={()=>{this.setState({error:null});location.reload()}}>Restart interface</button><button className="secondary" onClick={()=>{localStorage.clear();location.reload()}}>Reset local save</button></div></div>;
    return this.props.children;
  }
}
