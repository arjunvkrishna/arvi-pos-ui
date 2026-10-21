import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { PrinterSetting, GstSetting } from '../types/pos';
import { Settings, Printer, Wifi, Shield, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [billHost, setBillHost] = useState('192.168.1.37');
  const [billPort, setBillPort] = useState(9100);
  const [kotHost, setKotHost] = useState('192.168.1.47');
  const [kotPort, setKotPort] = useState(9100);
  const [juiceHost, setJuiceHost] = useState('192.168.1.42');
  const [juicePort, setJuicePort] = useState(9100);
  const [bridgeToken, setBridgeToken] = useState('');
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState(5);
  const [gstNumber, setGstNumber] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      const [printerCfg, bridge, gst] = await Promise.all([
        api.get<any>('/printer/config').catch(() => null),
        api.get<any>('/printer/bridge/status').catch(() => null),
        api.get<any>('/gst/config').catch(() => null),
      ]);
      if (printerCfg) {
        if (printerCfg.billPrinterHost) setBillHost(printerCfg.billPrinterHost);
        if (printerCfg.billPrinterPort) setBillPort(printerCfg.billPrinterPort);
        if (printerCfg.kotPrinterHost) setKotHost(printerCfg.kotPrinterHost);
        if (printerCfg.kotPrinterPort) setKotPort(printerCfg.kotPrinterPort);
        if (printerCfg.juiceKotPrinterHost) setJuiceHost(printerCfg.juiceKotPrinterHost);
        if (printerCfg.juiceKotPrinterPort) setJuicePort(printerCfg.juiceKotPrinterPort);
        if (printerCfg.bridgeToken) setBridgeToken(printerCfg.bridgeToken);
      }
      if (bridge) {
        setBridgeOnline(Boolean(bridge.connected || bridge.online));
      }
      if (gst) {
        setGstEnabled(gst.gstEnabled ?? true);
        setGstRate((gst.cgstPercent || 2.5) + (gst.sgstPercent || 2.5));
        setGstNumber(gst.gstNumber || '');
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSavePrinters = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/printer/config', {
        billPrinterHost: billHost,
        billPrinterPort: billPort,
        kotPrinterHost: kotHost,
        kotPrinterPort: kotPort,
        juiceKotPrinterHost: juiceHost,
        juiceKotPrinterPort: juicePort,
        bridgeToken,
      });
      setSaveStatus('Printer configuration saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to save printer config');
    }
  };

  const handleTestPrint = async (type: string) => {
    try {
      await api.post(`/printer/test?type=${encodeURIComponent(type)}`);
      alert(`Test print job dispatched to ${type} printer!`);
    } catch (e: any) {
      alert(e.message || `Test print failed for ${type}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
          <Settings className="w-7 h-7 text-amber-400" />
          <span>Hardware &amp; System Configuration</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">Configure thermal ESC/POS printers, IoT cloud bridge, and tax rates</p>
      </div>

      {saveStatus && (
        <div className="glass-panel border-emerald-500/40 p-3.5 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Cloud Bridge Status Pill */}
      <div className="glass-panel p-5 rounded-2xl border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">ESP32 Thermal Cloud Bridge</h3>
            <p className="text-xs text-slate-400">Long-polling hardware daemon for LAN printer routing</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 ${
          bridgeOnline
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          <span className={`w-2 h-2 rounded-full ${bridgeOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          <span>{bridgeOnline ? 'Bridge Online' : 'Polling Standby'}</span>
        </span>
      </div>

      {/* Printers Form */}
      <form onSubmit={handleSavePrinters} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Bill Printer */}
          <div className="glass-panel p-5 rounded-2xl border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Customer Bill Printer</span>
              </h3>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">IP Address / Host</label>
              <input
                type="text"
                value={billHost}
                onChange={(e) => setBillHost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={billPort}
                onChange={(e) => setBillPort(parseInt(e.target.value) || 9100)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleTestPrint('BILL')}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 transition"
            >
              Test Print Bill
            </button>
          </div>

          {/* Kitchen KOT Printer */}
          <div className="glass-panel p-5 rounded-2xl border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Kitchen KOT Printer</span>
              </h3>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">IP Address / Host</label>
              <input
                type="text"
                value={kotHost}
                onChange={(e) => setKotHost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={kotPort}
                onChange={(e) => setKotPort(parseInt(e.target.value) || 9100)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleTestPrint('KOT')}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-slate-700 transition"
            >
              Test Print KOT
            </button>
          </div>

          {/* Beverage / Juice KOT Printer */}
          <div className="glass-panel p-5 rounded-2xl border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Printer className="w-4 h-4 text-purple-400" />
                <span>Juice / Bar KOT Printer</span>
              </h3>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">IP Address / Host</label>
              <input
                type="text"
                value={juiceHost}
                onChange={(e) => setJuiceHost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={juicePort}
                onChange={(e) => setJuicePort(parseInt(e.target.value) || 9100)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleTestPrint('JUICE_KOT')}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs border border-slate-700 transition"
            >
              Test Print Juice KOT
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Save Printer Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
