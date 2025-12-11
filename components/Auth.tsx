
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Info, Briefcase, User as UserIcon, CheckCircle } from 'lucide-react';
import { login, register, loginWithGoogle } from '../services/storageService';
import { User, EntityType, SubscriptionPlan } from '../types';

interface AuthProps {
  onLoginSuccess: (user: User) => void;
  initialMode?: 'LOGIN' | 'REGISTER';
  initialEntityType?: EntityType;
  initialPlan?: SubscriptionPlan;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess, initialMode = 'LOGIN', initialEntityType = EntityType.PERSONAL, initialPlan = SubscriptionPlan.MONTHLY }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'CHECKOUT'>(initialMode === 'REGISTER' ? 'CHECKOUT' : 'LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<EntityType>(initialEntityType);
  const [plan, setPlan] = useState<SubscriptionPlan>(initialPlan);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
    const clientId = window.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
 
    if (window.google && clientId && mode === 'LOGIN') {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback
        });
        const buttonDiv = document.getElementById("googleSignInDiv");
        if (buttonDiv) {
          window.google.accounts.id.renderButton(
            buttonDiv,
            { theme: "outline", size: "large", width: "100%" } 
          );
        }
      } catch (e) {
        console.error("Erro ao inicializar botão do Google:", e);
      }
    }
  }, [mode]);

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
      if (mode === 'LOGIN') {
        data = await login(email, password);
      } else {
        // Register Flow
        data = await register(name, email, password, entityType, plan);
      }
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Se estiver no modo CHECKOUT/REGISTRO, mostra o fluxo de cadastro e "pagamento"
  if (mode === 'CHECKOUT' || mode === 'REGISTER') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row">
                {/* Lado esquerdo: Resumo do Pedido */}
                <div className="bg-slate-900 p-8 text-white md:w-1/3 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-4">Resumo do Pedido</h2>
                        <div className="space-y-4">
                            <div className="bg-white/10 p-4 rounded-xl">
                                <p className="text-xs text-gray-400 uppercase font-bold">Plano Escolhido</p>
                                <p className="text-lg font-bold text-indigo-400">
                                    {entityType === EntityType.PERSONAL ? 'Pessoa Física' : 'Pessoa Jurídica'}
                                </p>
                                <p className="text-sm text-gray-300">
                                    {plan === SubscriptionPlan.MONTHLY ? 'Assinatura Mensal' : 'Assinatura Anual'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                <span>15 dias de teste grátis</span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                <span>Cancele a qualquer momento</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 pt-4 border-t border-white/20 text-xs text-gray-400">
                        Ao continuar, você concorda com nossos termos de serviço.
                    </div>
                </div>

                {/* Lado direito: Form */}
                <div className="p-8 md:w-2/3">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Criar Conta</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button
                                type="button"
                                onClick={() => setEntityType(EntityType.PERSONAL)}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${entityType === EntityType.PERSONAL ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}
                            >
                                <UserIcon className="w-5 h-5" />
                                <span className="text-xs font-bold">Pessoa Física</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEntityType(EntityType.BUSINESS)}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${entityType === EntityType.BUSINESS ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}
                            >
                                <Briefcase className="w-5 h-5" />
                                <span className="text-xs font-bold">Pessoa Jurídica</span>
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo / Razão Social</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Seu nome"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email Profissional ou Pessoal</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="seu@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Simulação de Checkout - Em app real, aqui iriam os inputs do Cartão */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Dados de Pagamento (Simulação)</p>
                            <div className="flex gap-2">
                                <input type="text" disabled placeholder="**** **** **** 4242" className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-sm text-gray-400 cursor-not-allowed"/>
                                <input type="text" disabled placeholder="MM/AA" className="w-20 bg-white border border-gray-200 rounded px-2 py-1 text-sm text-gray-400 cursor-not-allowed"/>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">
                                * Nenhum valor será cobrado hoje. Seu período de teste de 15 dias começa agora.
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-lg">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Processando...' : 'Finalizar Cadastro e Iniciar Teste'}
                        </button>

                        <div className="text-center mt-4">
                            <button type="button" onClick={() => setMode('LOGIN')} className="text-sm text-indigo-600 hover:underline">
                                Já tenho conta
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      );
  }

  // LOGIN MODE
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col md:flex-row">
        <div className="p-8 w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">FinManager</h1>
            <p className="text-gray-500 mt-2">Bem-vindo de volta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {loading ? 'Entrando...' : 'Entrar'} <LogIn className="w-4 h-4" />
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
             
             <div className="mt-6 min-h-[48px]" id="googleSignInDiv"></div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode('REGISTER')}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Não tem conta? Cadastre-se grátis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
