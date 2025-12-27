
import React, { useState } from 'react';
import { runGeminiServiceTests, TestReport } from '../services/geminiService.test';

const TestPanel: React.FC = () => {
  const [reports, setReports] = useState<TestReport[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [show, setShow] = useState(false);

  const startTests = async () => {
    setIsRunning(true);
    setReports([]);
    const results = await runGeminiServiceTests();
    setReports(results);
    setIsRunning(false);
  };

  if (!show) {
    return (
      <button 
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 bg-slate-800 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform z-50 border border-slate-700"
        title="Open Dev Test Suite"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <h3 className="font-bold text-sm tracking-tight">Service Quality Suite</h3>
        </div>
        <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="p-4 max-h-64 overflow-y-auto bg-slate-50">
        {reports.length === 0 && !isRunning ? (
          <div className="text-center py-6">
            <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p className="text-xs text-slate-400">Ready to verify service logic.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {isRunning && reports.length === 0 && (
              <div className="text-xs text-slate-500 animate-pulse text-center py-4">Initializing test cases...</div>
            )}
            {reports.map((report, i) => (
              <div key={i} className="flex items-start gap-3 text-xs p-2 bg-white rounded-lg border border-slate-100 shadow-sm animate-in fade-in slide-in-from-left-2">
                {report.status === 'passed' ? (
                  <div className="p-1 bg-emerald-50 rounded-md">
                    <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                ) : (
                  <div className="p-1 bg-red-50 rounded-md">
                    <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-slate-700 leading-tight">{report.name}</p>
                  {report.error && <p className="text-red-500 mt-1 font-medium">{report.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <button 
          onClick={startTests}
          disabled={isRunning}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {isRunning ? 'Executing Suite...' : 'Run Unit Tests'}
        </button>
      </div>
    </div>
  );
};

export default TestPanel;
