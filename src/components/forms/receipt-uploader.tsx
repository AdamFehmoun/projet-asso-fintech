'use client';

import { useState, useCallback } from 'react';
import { UploadCloud, Loader2, CheckCircle, FileText } from 'lucide-react';
import { scanReceipt, ScanResult } from '@/app/actions/scan-receipt';

type ScanSuccess = Extract<ScanResult, { success: true }>;

interface ReceiptUploaderProps {
  onScanComplete: (data: ScanSuccess) => void;
}

export function ReceiptUploader({ onScanComplete }: ReceiptUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    // Aperçu immédiat
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsScanning(true);

    // Préparation de l'envoi
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Appel Server Action
      const data = await scanReceipt(formData);
      
      if (data.success) {
        onScanComplete(data);
      } else {
        alert("Erreur lecture: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-slate-700 mb-2">Justificatif (Scan IA)</label>
      
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 transition-all text-center cursor-pointer ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        } ${preview ? 'bg-emerald-50 border-emerald-200' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
        }}
      >
        <input 
          type="file" 
          accept="image/*" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          {isScanning ? (
            <>
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-blue-600">L'IA analyse votre ticket...</p>
            </>
          ) : preview ? (
            <>
              <CheckCircle className="w-8 h-8 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">Analyse terminée !</p>
              <p className="text-xs text-emerald-600">Les champs ont été remplis.</p>
            </>
          ) : (
            <>
              <div className="p-3 bg-white rounded-full shadow-sm">
                <UploadCloud className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Cliquez ou glissez un ticket ici</p>
                <p className="text-xs text-slate-500">JPG, PNG jusqu'à 5MB</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}