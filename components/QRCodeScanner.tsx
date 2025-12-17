
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import { X, Camera, RefreshCw, ScanBarcode } from 'lucide-react';

interface QRCodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  mode?: 'QR' | 'BARCODE'; // Default QR
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose, mode = 'QR' }) => {
  const [error, setError] = useState<string>('');
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-container";

  useEffect(() => {
    let mounted = true;

    // Inicializar e listar câmeras
    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (mounted) {
            if (devices && devices.length) {
                setCameras(devices);
                // Prefira a câmera traseira (environment) se houver mais de uma
                const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('traseira') || d.label.toLowerCase().includes('environment'));
                setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
            } else {
                setError('Nenhuma câmera encontrada.');
            }
        }
      } catch (err) {
        if (mounted) setError('Erro ao acessar a câmera. Verifique as permissões.');
      }
    };
    init();

    return () => {
      mounted = false;
      cleanupScanner();
    };
  }, []);

  const cleanupScanner = () => {
      if (scannerRef.current) {
          try {
              // Só tenta parar se estiver escaneando ou pausado
              const state = scannerRef.current.getState();
              if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                  scannerRef.current.stop().then(() => {
                      scannerRef.current?.clear();
                  }).catch(console.error);
              } else {
                  scannerRef.current.clear();
              }
          } catch (e) {
              console.error("Erro ao limpar scanner", e);
          }
      }
  };

  useEffect(() => {
    if (activeCameraId) {
      startScanner(activeCameraId);
    }
  }, [activeCameraId]);

  const startScanner = (cameraId: string) => {
    cleanupScanner();

    // Configurar formatos baseados no modo
    const formats = mode === 'BARCODE' 
        ? [ 
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8, 
            Html5QrcodeSupportedFormats.UPC_A, 
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
          ]
        : [ Html5QrcodeSupportedFormats.QR_CODE ];

    const html5QrCode = new Html5Qrcode(readerId, { 
        formatsToSupport: formats,
        verbose: false 
    });
    scannerRef.current = html5QrCode;

    // Aspect Ratio: QR (1.0) vs Barcode (mais largo ajuda na leitura)
    const aspectRatio = mode === 'BARCODE' ? 1.7 : 1.0;
    const qrBox = mode === 'BARCODE' ? { width: 300, height: 150 } : { width: 250, height: 250 };

    html5QrCode.start(
      cameraId, 
      {
        fps: 15, // Aumenta um pouco FPS para barcode
        qrbox: qrBox,
        aspectRatio: aspectRatio,
      },
      (decodedText) => {
        // Sucesso
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            onScanSuccess(decodedText);
        }).catch((err) => {
            console.error("Erro ao parar após sucesso", err);
            onScanSuccess(decodedText); 
        });
      },
      (errorMessage) => {
        // Falha na leitura do frame ignorada
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
          setActiveCameraId(nextId);
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
              {mode === 'BARCODE' ? <ScanBarcode className="w-6 h-6" /> : <Camera className="w-5 h-5" />}
              {mode === 'BARCODE' ? 'Ler Código de Barras' : 'Escanear QR Code'}
          </h3>
          <p className="text-sm text-gray-300 mt-1">
              {mode === 'BARCODE' 
                ? 'Centralize o código de barras do produto na linha vermelha' 
                : 'Aponte a câmera para o código da NFC-e/SAT'}
          </p>
      </div>

      <div className={`relative w-full max-w-sm bg-black overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl mx-4 ${mode === 'BARCODE' ? 'aspect-video' : 'aspect-square'}`}>
        <div id={readerId} className="w-full h-full"></div>
        
        {/* Overlay de mira */}
        <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"></div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-indigo-500 rounded-lg pointer-events-none shadow-[0_0_20px_rgba(99,102,241,0.5)] ${mode === 'BARCODE' ? 'w-64 h-24' : 'w-64 h-64'}`}>
            {mode === 'BARCODE' && (
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 opacity-50"></div>
            )}
        </div>
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
