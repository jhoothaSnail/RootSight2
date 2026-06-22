import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Network, ShieldAlert } from 'lucide-react';

export default function KnowledgeIngestion({ onFinish }: { onFinish: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [classificationStatus, setClassificationStatus] = useState<'idle' | 'classifying' | 'done'>('idle');
  const [graphStatus, setGraphStatus] = useState<'idle' | 'generating' | 'done'>('idle');
  const [isHovering, setIsHovering] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files?.length) {
      setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
      if (classificationStatus === 'idle') simulateClassification();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      if (classificationStatus === 'idle') simulateClassification();
    }
  };

  const simulateClassification = () => {
    setClassificationStatus('classifying');
    setTimeout(() => {
      setClassificationStatus('done');
    }, 2000);
  };

  const generateGraph = () => {
    setGraphStatus('generating');
    setTimeout(() => {
      setGraphStatus('done');
    }, 4000); // multiple loading states to show
  };

  const classifications = [
    { name: 'Architecture Documentation', found: files.length > 0 },
    { name: 'Service Catalog', found: files.length > 0 },
    { name: 'Incident History', found: files.length > 1 },
    { name: 'Runbooks', found: files.length > 2 },
  ];

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 overflow-y-auto w-full">
      <div className="w-full space-y-12 pb-24">
        <div>
          <h1 className="font-display font-bold text-zinc-100 mb-2 uppercase tracking-tight text-3xl md:text-4xl lg:text-5xl">Upload Organizational Knowledge</h1>
          <p className="text-zinc-400 font-light text-base md:text-lg">Upload architecture documents, service catalogs, incident reports, runbooks, SOPs, or other operational documentation.</p>
        </div>

        {/* Step 1: Upload */}
        <div className="space-y-6">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
            onDragLeave={() => setIsHovering(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all ${isHovering ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/30'}`}
          >
            <div className={`p-4 rounded-full mb-4 ${isHovering ? 'bg-amber-500/10' : 'bg-zinc-800/50'}`}>
              <Upload className={`w-8 h-8 ${isHovering ? 'text-amber-500' : 'text-zinc-400'}`} />
            </div>
            <p className="text-zinc-300 font-medium mb-1">Drag and drop files here</p>
            <p className="text-zinc-500 text-sm mb-6">Supports PDF, CSV, TXT, DOCX</p>
            <label className="cursor-pointer px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded transition-colors border border-zinc-700">
              Browse Files
              <input type="file" multiple className="hidden" onChange={handleFileSelect} accept=".pdf,.csv,.txt,.docx" />
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-mono text-zinc-500 uppercase tracking-widest mb-3">Uploaded Sources</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded bg-[#0d0d0f] border border-zinc-900">
                    <FileText className="w-4 h-4 text-amber-500/70" />
                    <span className="text-sm text-zinc-300 truncate">{file.name}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Classification */}
        <AnimatePresence>
          {files.length > 0 && classificationStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl lg:text-2xl font-display font-medium text-zinc-200">Knowledge Coverage</h3>
                {classificationStatus === 'done' && (
                  <div className="text-xs md:text-sm lg:text-base font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-1 rounded">
                    Graph Readiness: {Math.min(82 + (files.length * 5), 100)}%
                  </div>
                )}
              </div>
              
              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                {classificationStatus === 'classifying' ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-amber-500 animate-spin mb-4" />
                    <p className="text-zinc-400 font-mono text-xs md:text-sm uppercase tracking-widest animate-pulse">Classifying Documents...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {classifications.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {item.found ? (
                          <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-amber-500 shrink-0" />
                        )}
                        <span className={`text-sm md:text-base ${item.found ? 'text-zinc-200' : 'text-zinc-500'}`}>{item.name} {item.found ? '' : 'Missing'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Generation */}
        {classificationStatus === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {graphStatus === 'idle' && (
              <button
                onClick={generateGraph}
                className="self-start flex items-center justify-center gap-3 px-8 py-4 rounded bg-zinc-800 text-zinc-100 font-bold uppercase tracking-wider text-xs md:text-sm transition-all hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500"
              >
                <Network className="w-5 h-5" />
                Generate Intelligence Graph
              </button>
            )}

            {graphStatus === 'generating' && (
              <div className="w-full bg-[#0d0d0f] border border-zinc-900 rounded p-6 font-mono text-xs md:text-sm text-zinc-400 space-y-4 shadow-xl">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0 }}>
                   <span className="text-amber-500/50 mr-3">&gt;&gt;</span> Extracting Entities...
                 </motion.div>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
                   <span className="text-amber-500/50 mr-3">&gt;&gt;</span> Building Relationships...
                 </motion.div>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}>
                   <span className="text-amber-500/50 mr-3">&gt;&gt;</span> Generating Dependency Graph...
                 </motion.div>
              </div>
            )}

            {graphStatus === 'done' && (
              <div className="flex flex-col gap-8 w-full">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400">
                   <CheckCircle2 className="w-5 h-5" />
                   <span className="font-medium text-sm md:text-base">Graph Generated Successfully</span>
                </div>

                <div className="border-t border-zinc-900 pt-8 mt-2">
                  <button
                    onClick={onFinish}
                    className="group relative flex items-center justify-center gap-3 px-8 py-4 w-full sm:w-auto rounded bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 font-bold uppercase tracking-wider text-xs md:text-sm transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] active:scale-95"
                  >
                    <ShieldAlert className="w-5 h-5" />
                    Run Incident Analysis
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
