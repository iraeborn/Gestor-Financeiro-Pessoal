import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Info } from 'lucide-react';
import { login, register, loginWithGoogle } from '../services/storageService';
import { User } from '../types';

interface AuthProps {
  onLoginSuccess: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');

  // Inicializa o botão do Google
  useEffect(() => {
    // Captura a origem atual para mostrar ao usuário caso precise configurar
    setCurrentOrigin(window.location.origin);

    // Tenta pegar do Window (Produção/Docker/Cloud Run) ou do process.env (Desenvolvimento Vite Local)
    const clientId = window.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID não encontrado.');
    } else if (window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback,
        });

        const buttonDiv = document.getElementById('googleSignInDiv');
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, { theme: 'outline', size: 'large', width: '100%' });
        }
      } catch (e) {
        console.error('Erro ao inicializar botão do Google:', e);
      }
    }
  }, []);

  const handleGoogleCallback = async (response: any) => {
    setLoading(true);
    setError('');
    try {
      const data = await loginWithGoogle(response.credential);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar com Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isRegistering) {
        data = await register(name, email, password);
      } else {
        data = await login(email, password);
      }
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col md:flex-row">
        {/* Form Section */}
        <div className="p-8 w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Financial Manager</h1>
            <p className="text-gray-500 mt-2">{isRegistering ? 'Crie sua conta para começar' : 'Bem-vindo de volta'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome</label>
                <div className="relative">
                  <UserPlus className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="pl-10 w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Seu nome" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="seu@email.com" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
              ) : (
                <>
                  {isRegistering ? 'Criar Conta' : 'Entrar'}
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Ou continue com</span>
              </div>
            </div>

            <div className="mt-6 min-h-[48px]" id="googleSignInDiv">
              {!window.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID && <div className="text-xs text-center text-red-400 bg-red-50 p-2 rounded">Google Login Indisponível (Client ID ausente)</div>}
            </div>

            {/* Helper text for Google Auth Errors */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-100 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Problemas com Google?</p>
                <p>
                  Certifique-se de que a URL abaixo está nas <strong>Origens Autorizadas</strong> do seu Cloud Console:
                </p>
                <code
                  className="block mt-1 bg-white px-1 py-0.5 rounded border border-blue-200 break-all select-all cursor-pointer"
                  onClick={(e) => {
                    navigator.clipboard.writeText(e.currentTarget.innerText);
                    alert('Copiado!');
                  }}
                >
                  {currentOrigin}
                </code>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se grátis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
