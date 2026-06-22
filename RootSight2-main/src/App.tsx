import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, LayoutDashboard, Building2, PanelLeftClose, PanelLeft, Server, BookOpen } from 'lucide-react';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import OrgIntelligence from './components/OrgIntelligence';
import Architecture from './components/Architecture';
import Runbooks from './components/Runbooks';
import { Logo } from './components/Logo';
import type { ViewState } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [navCollapsed, setNavCollapsed] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home onNavigate={setCurrentView} />;
      case 'dashboard':
        return <Dashboard />;
      case 'architecture':
        return <Architecture />;
      case 'runbooks':
        return <Runbooks />;
      case 'org':
        return <OrgIntelligence />;
      default:
        return <Home onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex overflow-hidden selection:bg-amber-500/30">
      
      {/* Sidebar Navigation */}
      {currentView !== 'home' && (
        <motion.nav 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`shrink-0 flex flex-col bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-900 pt-6 px-4 transition-all duration-300 ${navCollapsed ? 'w-20' : 'w-64'}`}
          style={{ zIndex: 50 }}
        >
          <div className="flex items-center justify-between mb-10 px-2">
             <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentView('home')} role="button">
                <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(245,158,11,0.2)] shrink-0 transition-transform group-hover:scale-105" />
                {!navCollapsed && <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap uppercase">RootSight</span>}
             </div>
             <button onClick={() => setNavCollapsed(!navCollapsed)} className="text-zinc-600 hover:text-zinc-300 hidden md:block transition-colors">
               {navCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
             </button>
          </div>

          <div className="space-y-1.5 flex-1">
             <div className="mb-4 px-2">
                {!navCollapsed && <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest font-semibold">Operations</p>}
             </div>
             <NavItem 
               icon={<LayoutDashboard />} 
               label="Analysis Engine" 
               active={currentView === 'dashboard'} 
               onClick={() => setCurrentView('dashboard')} 
               collapsed={navCollapsed}
             />
             <NavItem 
               icon={<Server />} 
               label="Architecture Map" 
               active={currentView === 'architecture'} 
               onClick={() => setCurrentView('architecture')} 
               collapsed={navCollapsed}
             />
             
             <div className="mt-8 mb-4 px-2">
                {!navCollapsed && <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest font-semibold">Intelligence</p>}
             </div>
             <NavItem 
               icon={<BookOpen />} 
               label="AI Runbooks" 
               active={currentView === 'runbooks'} 
               onClick={() => setCurrentView('runbooks')} 
               collapsed={navCollapsed}
             />
             <NavItem 
               icon={<Building2 />} 
               label="Org Intelligence" 
               active={currentView === 'org'} 
               onClick={() => setCurrentView('org')} 
               collapsed={navCollapsed}
             />
          </div>
          
          <div className="pb-6">
            {!navCollapsed && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3">
                 <div className="relative flex h-2.5 w-2.5">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                 </div>
                 <div className="flex-1">
                    <p className="text-xs text-zinc-300 font-medium tracking-wide">System Live</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Monitoring 48 nodes</p>
                 </div>
              </div>
            )}
          </div>
        </motion.nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative h-screen overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm group
        ${active 
          ? 'bg-amber-500/10 text-amber-500' 
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
        }
      `}
      title={collapsed ? label : undefined}
    >
      <div className={`shrink-0 ${active ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
        {icon}
      </div>
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      {active && !collapsed && (
        <motion.div layoutId="nav-pill" className="absolute left-0 w-1 h-6 bg-amber-500 rounded-r-md" />
      )}
    </button>
  );
}
