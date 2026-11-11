import React,{Component,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
class AppBoundary extends Component<{children:ReactNode},{error:boolean}>{
  state={error:false}
  static getDerivedStateFromError(){return {error:true}}
  render(){return this.state.error?<main style={{color:'#ead3a0',background:'#080d12',padding:40}}><h1>Headquarters could not start on this device.</h1><p>Your release records are still available.</p><nav aria-label="Employee dashboards"><a href="/label-world/agents/researcher">Carla</a> · <a href="/label-world/agents/reviewer">Eric</a> · <a href="/label-world/agents/executive">Executive</a> · <a href="/label-world/agents/builder">Builder</a></nav><a href="/label-world/dashboard">Open release intake controls</a><button onClick={()=>location.reload()}>Retry</button></main>:this.props.children}
}
createRoot(document.getElementById('label-world-app')!).render(<AppBoundary><App/></AppBoundary>)
