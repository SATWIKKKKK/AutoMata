import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Background,
  Controls,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowDAG, WorkflowNode, WorkflowEdge } from '../services/geminiService';
import { CronTriggerNode, LLMCallNode, ToolCallNode, ConditionNode, HumanGateNode, EvaluatorNode } from '../components/workflow/Nodes';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, Save, Plus } from 'lucide-react';

const nodeTypes = {
  cron_trigger: CronTriggerNode,
  llm_call: LLMCallNode,
  tool_call: ToolCallNode,
  evaluator: EvaluatorNode,
  condition: ConditionNode,
  human_gate: HumanGateNode,
};

interface EditorProps {
  workflow: WorkflowDAG | null;
  onSave: (dag: WorkflowDAG) => void;
}

export default function Editor({ workflow, onSave }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    if (workflow) {
      setNodes(workflow.nodes.map(n => ({
        ...n,
        type: n.type,
        data: { label: n.label, config: n.config }
      })));
      setEdges(workflow.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
      })));
    }
  }, [workflow]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNode(node);
  };

  return (
    <div className="h-full w-full relative flex">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background 
            className="blueprint-grid opacity-20" 
            gap={48} 
            size={1} 
          />
          <Controls position="bottom-right" className="!shadow-none !border-blueprint-line" />
          
          <Panel position="top-right" className="flex gap-2">
            <button className="bg-blueprint-bg border border-blueprint-line p-2 rounded-full hover:border-blueprint-accent transition-all">
              <Plus size={20} />
            </button>
          </Panel>
        </ReactFlow>
      </div>

      <AnimatePresence>
        {selectedNode && (
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-96 border-l border-blueprint-line bg-surface-container-lowest h-full overflow-y-auto z-10 flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-blueprint-line flex justify-between items-center bg-blueprint-bg/30">
              <div>
                <h3 className="text-ui-label text-blueprint-accent">Properties</h3>
                <p className="text-technical-mono text-blueprint-muted mt-1">{selectedNode.data.label}</p>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-blueprint-line rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8 flex-1">
              <div className="space-y-2">
                <label className="text-technical-mono text-blueprint-accent opacity-60">Node Title</label>
                <input 
                  type="text" 
                  value={selectedNode.data.label}
                  onChange={(e) => {
                    const newNodes = nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n);
                    setNodes(newNodes);
                  }}
                  className="w-full bg-transparent border-b border-blueprint-line text-body-md py-2 focus:outline-none focus:border-blueprint-accent"
                />
              </div>

              {selectedNode.type === 'llm_call' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-technical-mono text-blueprint-accent opacity-60">System Prompt</label>
                    <textarea 
                       rows={6}
                       defaultValue={selectedNode.data.config.system_prompt}
                       className="w-full bg-surface-container-low border-0 rounded-lg p-4 font-mono text-[13px] focus:ring-1 focus:ring-blueprint-accent resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-technical-mono text-blueprint-accent opacity-60">Model Selector</label>
                    <select className="w-full bg-surface-container-low border-0 rounded-lg p-3 text-body-md appearance-none">
                      <option>GEMINI-3-FLASH</option>
                      <option>GEMINI-3.1-PRO</option>
                      <option>CLAUDE-3-HAIKU</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'tool_call' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-technical-mono text-blueprint-accent opacity-60">Provider</label>
                     <div className="p-3 bg-surface-container-low rounded-lg text-body-md uppercase font-bold tracking-tighter">
                       {selectedNode.data.config.mcp_server}
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-technical-mono text-blueprint-accent opacity-60">Action</label>
                     <input 
                        type="text"
                        defaultValue={selectedNode.data.config.tool_name}
                        className="w-full bg-surface-container-low border-0 rounded-lg p-3 text-body-md focus:ring-1 focus:ring-blueprint-accent"
                     />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-blueprint-line bg-blueprint-bg/10">
              <button 
                className="w-full bg-blueprint-accent text-white py-3 rounded-full text-ui-label hover:opacity-90 transition-opacity flex justify-center items-center gap-2"
                onClick={() => {
                   onSave({
                     workflow_name: workflow?.workflow_name || 'Workflow',
                     description: workflow?.description || '',
                     nodes: nodes.map(n => ({ id: n.id, type: n.type || '', label: n.data.label as string, config: n.data.config, position: n.position })),
                     edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label as string }))
                   });
                   setSelectedNode(null);
                }}
              >
                <Save size={18} />
                Save Changes
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
