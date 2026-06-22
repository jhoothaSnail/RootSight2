import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, UploadCloud, FileText, Database, Activity, ArrowRight, CheckCircle2, Circle, X, FileSearch, Network } from 'lucide-react';

interface IntelligenceWorkspaceProps {
  onComplete: () => void;
}

// File Uploader Component
function FileUploader({ 
  id, 
  title, 
  onUpload, 
  onRemove, 
  file, 
  disabled, 
  accept = ".pdf,.docx,.txt,.csv,.xlsx",
  isOptional = false
}: { 
  id: string; 
  title: string; 
  onUpload: (fileName: string) => void; 
  onRemove: () => void; 
  file: string | null; 
  disabled: boolean;
  accept?: string;
  isOptional?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled && status === 'idle') return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled && status === 'idle') return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled && status === 'idle') return;
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (f: File) => {
    setStatus('uploading');
    setTimeout(() => {
      setStatus('complete');
      onUpload(f.name);
    }, 1200);
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus('idle');
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => { if (!disabled || status === 'complete') inputRef.current?.click() }}
      className={`relative w-full border-2 border-dashed rounded-lg p-4 transition-all ${
        disabled && status === 'idle' ? 'opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-900/20' : 
        isDragging ? 'border-amber-500 bg-amber-500/5 cursor-copy' : 
        file ? 'border-amber-500/30 bg-zinc-900/50 cursor-pointer hover:border-amber-500/50' : 
        'border-zinc-800 bg-zinc-900/30 cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50'
      }`}
    >
      <input 
        ref={inputRef}
        type="file" 
        accept={accept}
        className="hidden" 
        onChange={handleChange}
        disabled={disabled && status === 'idle'}
      />
      
      <div className="flex flex-col h-full justify-center">
        {!file && status === 'idle' && (
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded ${isOptional ? 'bg-zinc-800/80 text-zinc-400' : 'bg-amber-500/10 text-amber-500'}`}>
               {isOptional ? <FileSearch className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
             </div>
             <div>
               <h4 className={`text-sm font-semibold tracking-wide ${isOptional ? 'text-zinc-300' : 'text-zinc-200'}`}>
                 {title} {isOptional && <span className="text-[10px] font-mono text-zinc-500 ml-1 border border-zinc-800 px-1 py-0.5 rounded uppercase font-normal">Optional</span>}
               </h4>
               <p className="text-xs text-zinc-500 mt-1">Click to browse or drag and drop</p>
               <p className="text-[10px] text-zinc-600 font-mono mt-0.5 uppercase tracking-wider">PDF, DOCX, TXT, CSV, XLSX</p>
             </div>
          </div>
        )}
        
        {status === 'uploading' && (
          <div className="flex items-center gap-3">
             <div className="p-2 rounded bg-amber-500/10 text-amber-500">
               <UploadCloud className="w-5 h-5 animate-bounce" />
             </div>
             <div className="flex-1">
               <h4 className="text-sm font-semibold tracking-wide text-zinc-200">{title}</h4>
               <p className="text-xs text-amber-500 mt-1 animate-pulse font-mono uppercase tracking-wider">Uploading...</p>
             </div>
          </div>
        )}

        {file && status === 'complete' && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-amber-500/20 text-amber-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs font-mono uppercase tracking-widest text-amber-400/80">{title}</h4>
                <p className="text-sm font-medium text-zinc-200 truncate max-w-[150px] sm:max-w-[200px]">{file}</p>
                <div className="flex gap-2 text-[10px] uppercase font-mono tracking-wider mt-1 text-zinc-500">
                  <span className="text-amber-500">Uploaded</span>
                  <span className="hover:text-amber-400">Click to Replace</span>
                </div>
              </div>
            </div>
            {!disabled && (
              <button 
                onClick={removeFile}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntelligenceWorkspace({ onComplete }: IntelligenceWorkspaceProps) {
  const [requiredFiles, setRequiredFiles] = useState<Record<string, string | null>>({
    'arch-doc': null,
    'srv-cat': null,
    'inc-hist': null
  });
  
  const [optionalFiles, setOptionalFiles] = useState<{id: string, name: string}[]>([]);
  
  // Pipeline stages: 0=Upload, 1=Extract, 2=Classify, 3=Generate, 4=Ready
  const [pipelineStage, setPipelineStage] = useState<number>(0);
  const [animatedStage, setAnimatedStage] = useState<number>(0);
  const [activeOperation, setActiveOperation] = useState('Waiting For Documents');
  
  const [feed, setFeed] = useState<{ id: string, text: string, time: string }[]>([]);

  useEffect(() => {
    if (pipelineStage > animatedStage) {
      const timer = setTimeout(() => {
        setAnimatedStage(prev => prev + 1);
      }, 1200);
      return () => clearTimeout(timer);
    } else if (pipelineStage === 0 && animatedStage !== 0) {
      setAnimatedStage(0);
    }
  }, [pipelineStage, animatedStage]);

  const requiredSourcesList = [
    { id: 'arch-doc', label: 'Architecture Documentation' },
    { id: 'srv-cat', label: 'Service Catalog' },
    { id: 'inc-hist', label: 'Incident History' }
  ];

  const addFeedItem = (text: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setFeed(prev => [{ id: Math.random().toString(), text, time }, ...prev].slice(0, 50));
  };

  const isRequiredComplete = Object.values(requiredFiles).filter(f => f !== null).length >= 2;

  useEffect(() => {
    if (pipelineStage === 0) {
      if (isRequiredComplete) {
        setActiveOperation('Ready for Intelligence Extraction');
      } else {
        setActiveOperation('Waiting For Documents');
      }
    }
  }, [isRequiredComplete, pipelineStage]);

  const handleUploadRequired = (id: string, fileName: string, label: string) => {
    setRequiredFiles(prev => ({ ...prev, [id]: fileName }));
    addFeedItem(`${label} Uploaded: ${fileName}`);
  };

  const handleRemoveRequired = (id: string, label: string) => {
    setRequiredFiles(prev => ({ ...prev, [id]: null }));
    addFeedItem(`${label} Removed`);
  };

  const handleUploadOptional = (fileName: string) => {
    const newId = Math.random().toString();
    setOptionalFiles(prev => [...prev, { id: newId, name: fileName }]);
    addFeedItem(`Additional Source Uploaded: ${fileName}`);
  };

  const handleRemoveOptional = (id: string) => {
    setOptionalFiles(prev => prev.filter(f => f.id !== id));
    addFeedItem(`Additional Source Removed`);
  };

  const startExtraction = () => {
    setPipelineStage(1);
    setActiveOperation('Extracting Services');
    addFeedItem('Started Intelligence Extraction');
    
    setTimeout(() => {
      setActiveOperation('Extracting Teams');
      addFeedItem('12 Services Identified');
    }, 2000);
    
    setTimeout(() => {
      addFeedItem('3 Teams Identified');
      addFeedItem('5 Vendors Identified');
      setPipelineStage(2);
      setActiveOperation('Classifying Relationships');
    }, 4000);

    setTimeout(() => {
      addFeedItem('27 Relationships Classified');
      setPipelineStage(3);
      setActiveOperation('Ready for Graph Generation');
    }, 6000);
  };

  const generateGraph = () => {
    setActiveOperation('Generating Dependency Graph');
    addFeedItem('Compiling topography logic...');
    
    setTimeout(() => {
      addFeedItem('Dependency Graph Generated');
      setPipelineStage(4);
      setActiveOperation('Architecture Ready');
    }, 2500);
  };

  const totalSources = requiredSourcesList.length; // Ignore optional for strict completion metrics
  const uploadedCount = Object.values(requiredFiles).filter(f => f !== null).length;
  const coveragePercent = Math.round((uploadedCount / totalSources) * 100);

  const pipelineSteps = [
    'Upload Knowledge',
    'Extract Entities',
    'Classify Relationships',
    'Generate Dependency Graph',
    'Architecture Ready'
  ];

  return (
    <div className="w-full flex h-full">
      <div className="w-full flex flex-col h-full overflow-y-auto pr-4 space-y-8 custom-scrollbar">
        
        {/* Header */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded font-mono text-xs md:text-sm text-zinc-400 uppercase tracking-widest backdrop-blur-sm self-start">
            <Activity className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
            Organizational Intelligence
          </div>
          <h2 className="font-display font-bold tracking-tight text-zinc-100 leading-[1.1] text-3xl md:text-4xl mt-4">
            Learning Workspace
          </h2>
          <p className="text-zinc-400 font-light leading-relaxed text-sm md:text-base mt-2">
            Ingest documentation to construct a topological map of your incident surface area.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6 shrink-0 flex-1">
          
          {/* Left Column: Pipeline & Coverage */}
          <div className="md:col-span-4 flex flex-col gap-6 h-full">
            {/* Active Operation */}
            <div className="bg-[#0d0d0f] border border-zinc-800 rounded-lg p-5 shrink-0">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3 font-semibold">Active Operation</h3>
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3 shrink-0">
                  {pipelineStage < 4 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${pipelineStage === 4 ? 'bg-teal-500' : 'bg-amber-500'}`}></span>
                </div>
                <span className="text-sm font-medium tracking-wide text-zinc-200">
                  {activeOperation}
                </span>
              </div>
            </div>

            {/* Pipeline with Fluid Tube */}
            <div className="bg-[#0d0d0f] border border-zinc-800 rounded-lg p-5 relative overflow-hidden flex-1 min-h-[350px]">
               <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-6 font-semibold">Intelligence Pipeline</h3>
               <div className="relative mt-4 flex flex-col justify-between flex-1 pb-2" style={{ minHeight: '380px' }}>
                 
                 {/* System 1: Fluid Tube Column */}
                 <div className="absolute top-[10px] bottom-[10px] left-2 w-3.5 bg-zinc-950 rounded-full border border-zinc-800/80 overflow-hidden shadow-[inset_0_4px_12px_rgba(0,0,0,1)] flex flex-col justify-start z-0">
                    {/* The Animated Fluid */}
                    <div 
                      className="w-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 relative flex items-start justify-center overflow-hidden border-b-2 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.8)]"
                      style={{ 
                        height: `${Math.max(4, (pipelineStage / (pipelineSteps.length - 1)) * 100)}%`,
                        transition: 'height 1200ms ease-in-out'
                      }}
                    >
                       <div className="w-full h-full absolute inset-0 opacity-40 bg-[linear-gradient(rgba(0,0,0,0.5)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.5)_50%,rgba(0,0,0,0.5)_75%,transparent_75%,transparent_100%)] bg-[length:100%_20px] animate-[flow-down_1s_linear_infinite]" />
                       <div className="w-[1px] h-full bg-white/30 absolute left-[30%] mix-blend-overlay" />
                    </div>
                 </div>

                 {/* System 2: Stage Completion Nodes */}
                 <div className="absolute inset-0 flex flex-col justify-between pl-14 pointer-events-none pb-2">
                   {pipelineSteps.map((step, idx) => {
                     const isCompleted = animatedStage > idx;
                     const isActive = animatedStage === idx;
                     
                     return (
                       <div key={idx} className="relative flex items-center gap-4 z-10 -ml-1">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-[#0d0d0f] ${
                           isCompleted ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 
                           isActive ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.7)] animate-pulse' : 
                           'border-zinc-800 shadow-none'
                         }`}>
                           {isCompleted ? (
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                               <Check className="w-4 h-4 text-amber-500 stroke-[3]" />
                             </motion.div>
                           ) : isActive ? (
                             <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,1)]" />
                           ) : (
                             <div className="w-2 h-2 rounded-full bg-zinc-800" />
                           )}
                         </div>
                         <span className={`text-xs font-medium leading-tight transition-colors duration-500 ${
                           isCompleted ? 'text-zinc-300' : 
                           isActive ? 'text-amber-500 font-semibold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                           'text-zinc-600'
                         }`}>
                           {step}
                         </span>
                       </div>
                     );
                   })}
                 </div>
               </div>
            </div>

            {/* Coverage */}
            <div className="bg-[#0d0d0f] border border-zinc-800 rounded-lg p-5 shrink-0">
               <div className="flex items-end justify-between font-mono mb-2">
                 <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Required Coverage</h3>
                 <span className="text-amber-500 font-bold">{coveragePercent}%</span>
               </div>
               <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                 <div 
                   className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                   style={{ width: `${coveragePercent}%` }}
                 ></div>
               </div>
            </div>
          </div>

          {/* Right Column: Ingestion & Feed */}
          <div className="md:col-span-8 flex flex-col gap-6 h-full">
            
            {/* Documents */}
            <div className="bg-[#0d0d0f] border border-zinc-800 rounded-lg px-6 py-5 flex-1 relative flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-6">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 font-semibold border-b border-zinc-800 pb-3 sticky top-0 bg-[#0d0d0f] z-10 pt-1">Document Ingestion</h3>
                
                {/* Required */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 mb-3 tracking-wide">
                    <Database className="w-4 h-4 text-amber-500" /> Required Sources
                  </h4>
                  <div className="flex flex-col gap-4">
                    {requiredSourcesList.map(src => (
                      <div key={src.id}>
                        <FileUploader 
                          id={src.id}
                          title={src.label}
                          file={requiredFiles[src.id]}
                          disabled={pipelineStage > 0}
                          onUpload={(name) => handleUploadRequired(src.id, name, src.label)}
                          onRemove={() => handleRemoveRequired(src.id, src.label)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mb-3 tracking-wide mt-6 border-t border-zinc-800 pt-6">
                    <FileSearch className="w-4 h-4 text-zinc-500" /> Additional Sources 
                  </h4>
                  <p className="text-xs text-zinc-500 mb-4 font-mono">
                    AI will automatically classify additional knowledge sources (Runbooks, SOPs, Vendor Documentation, Ownership Matrix).
                  </p>
                  <div className="flex flex-col gap-4">
                    {optionalFiles.map(file => (
                      <div key={file.id} className="relative w-full border-2 border-dashed border-amber-500/30 bg-zinc-900/50 rounded-lg p-4">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-amber-500/20 text-amber-500">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <h4 className="text-xs font-mono uppercase tracking-widest text-amber-400/80">Additional Source</h4>
                              <p className="text-sm font-medium text-zinc-200 truncate max-w-[150px] sm:max-w-[300px]">{file.name}</p>
                            </div>
                          </div>
                          {!disabled && pipelineStage === 0 && (
                            <button 
                              onClick={() => handleRemoveOptional(file.id)}
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <FileUploader 
                      id="optional-upload"
                      title="Upload Additional Source"
                      file={null}
                      disabled={pipelineStage > 0}
                      isOptional={true}
                      onUpload={(name) => handleUploadOptional(name)}
                      onRemove={() => {}}
                    />
                  </div>
                </div>

                {/* Intelligence Feed */}
                <div className="mt-4 border-t border-zinc-800 pt-6">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3 font-semibold flex items-center justify-between">
                    <span>Intelligence Feed</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 opacity-50 animate-pulse"></span>
                  </h3>
                  <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 h-[180px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
                    {feed.length === 0 ? (
                      <span className="text-xs font-mono text-zinc-600 italic">No activity yet.</span>
                    ) : (
                      feed.map((item, idx) => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-3 text-xs font-mono"
                        >
                          <span className="text-zinc-600 whitespace-nowrap">[{item.time}]</span>
                          <span className={idx === 0 ? 'text-amber-400 font-semibold' : 'text-zinc-400'}>{item.text}</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Action Buttons (Fixed at bottom of container without overlapping feed) */}
              <div className="shrink-0 pt-4 border-t border-zinc-800 flex flex-col items-end gap-2">
                {pipelineStage === 0 && (
                  <>
                    <button
                      onClick={startExtraction}
                      disabled={!isRequiredComplete}
                      className={`px-6 py-3 rounded text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        isRequiredComplete
                          ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      Start Intelligence Extraction
                    </button>
                    {!isRequiredComplete ? (
                      <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5"><span className="text-amber-500 text-[12px]">⚠</span> At least 2 required sources must be uploaded before extraction can begin.</p>
                    ) : (
                      <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" /> Minimum knowledge requirements satisfied</p>
                    )}
                  </>
                )}
                {pipelineStage === 3 && (
                  <button
                    onClick={generateGraph}
                    className="px-6 py-3 rounded text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 animate-pulse"
                  >
                    <Network className="w-4 h-4" /> Generate Dependency Graph
                  </button>
                )}
                {pipelineStage === 4 && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={onComplete}
                    className="w-full md:w-auto px-8 py-3 rounded text-sm font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 hover:shadow-[0_0_30px_rgba(20,184,166,0.3)] hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Enter RootSight Platform</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Architecture Ready block outside scroll pane if needed */}
            <AnimatePresence>
              {pipelineStage === 4 && (
                <motion.div 
                   initial={{ opacity: 0, height: 0, scale: 0.95 }}
                   animate={{ opacity: 1, height: 'auto', scale: 1 }}
                   className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0"
                >
                  <div className="flex items-center gap-3">
                     <CheckCircle2 className="w-6 h-6 text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                     <div>
                       <h4 className="text-sm font-bold tracking-wide text-teal-400 uppercase">Architecture Ready</h4>
                       <p className="text-xs text-teal-500/80 font-mono mt-0.5">Topological mapping complete and verified.</p>
                     </div>
                  </div>
                  <div className="flex gap-6 font-mono text-xs">
                     <div className="flex flex-col items-end">
                       <span className="text-teal-500/70 uppercase tracking-widest">Nodes Created</span>
                       <span className="text-teal-400 font-bold text-sm">184</span>
                     </div>
                     <div className="flex flex-col items-end">
                       <span className="text-teal-500/70 uppercase tracking-widest">Relationships</span>
                       <span className="text-teal-400 font-bold text-sm">412</span>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
