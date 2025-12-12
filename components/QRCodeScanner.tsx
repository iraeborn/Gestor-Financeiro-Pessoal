
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw } from 'lucide-react';

interface QRCodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const [error, setError] = useState<string>('');
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-container";

  useEffect(() => {
    // Inicializar e listar câmeras
    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          setCameras(devices);
          // Prefira a câmera traseira (environment) se houver mais de uma
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('traseira'));
          setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setError('Nenhuma câmera encontrada.');
        }
      } catch (err) {
        setError('Erro ao acessar a câmera. Verifique as permissões.');
      }
    };
    init();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    if (activeCameraId && !scannerRef.current) {
      startScanner(activeCameraId);
    }
  }, [activeCameraId]);

  const startScanner = (cameraId: string) => {
    const html5QrCode = new Html5Qrcode(readerId);
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      cameraId, 
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
      },
      (decodedText) => {
        // Sucesso
        html5QrCode.stop().then(() => {
            onScanSuccess(decodedText);
        }).catch(console.error);
      },
      (errorMessage) => {
        // Falha na leitura do frame (muito comum, ignorar erros de console)
      }
    ).catch(err => {
      console.error("Erro ao iniciar scanner", err);
      setError("Não foi possível iniciar o vídeo.");
    });
  };

  const switchCamera = () => {
      if (cameras.length > 1 && activeCameraId) {
          const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
          const nextIndex = (currentIndex + 1) % cameras.length;
          const nextId = cameras[nextIndex].id;
          
          if (scannerRef.current) {
              scannerRef.current.stop().then(() => {
                  scannerRef.current = null;
                  setActiveCameraId(nextId);
              });
          }
      }
  };

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center animate-fade-in">
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30 backdrop-blur-sm">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="text-white mb-6 text-center px-4">
          <h3 className="text-lg font-bold flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" /> Escanear QR Code da Nota
          </h3>
          <p className="text-sm text-gray-300 mt-1">Aponte a câmera para o código da NFC-e/SAT</p>
      </div>

      <div className="relative w-full max-w-sm aspect-square bg-black overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl mx-4">
        <div id={readerId} className="w-full h-full"></div>
        
        {/* Overlay de mira */}
        <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-indigo-500 rounded-lg pointer-events-none shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
      </div>

      {error && (
          <p className="text-rose-400 mt-4 text-sm bg-rose-900/20 px-4 py-2 rounded-lg">{error}</p>
      )}

      {cameras.length > 1 && (
          <button 
            onClick={switchCamera}
            className="mt-8 flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full text-white font-medium hover:bg-white/20 backdrop-blur-sm transition-colors"
          >
              <RefreshCw className="w-4 h-4" /> Trocar Câmera
          </button>
      )}
    </div>
  );
};

export default QRCodeScanner;
