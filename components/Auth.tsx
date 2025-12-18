
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Briefcase, User as UserIcon, CheckCircle, Search, Building, MapPin, FileText } from 'lucide-react';
import { login, register, loginWithGoogle, consultCnpj } from '../services/storageService';
import { User, EntityType, SubscriptionPlan, TaxRegime } from '../types';

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
  
  // PJ Specific State
  const [cnpj, setCnpj] = useState('');
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [companyData, setCompanyData] = useState({
      tradeName: '',
      legalName: '',
      cnae: '',
      secondaryCnaes: '',
      zipCode: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      phone: '',
      email: '',
      taxRegime: TaxRegime.SIMPLES,
      hasEmployees: false,
      issuesInvoices: false
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const win = window as any;
    const clientId = process.env.GOOGLE_CLIENT_ID || win.GOOGLE_CLIENT_ID;

    if (mode === 'LOGIN') {
      let retryCount = 0;
      const maxRetries = 10;

      const initGoogle = () => {
        if (win.google?.accounts?.id) {
          if (!clientId) {
            console.warn("Google Client ID não configurado nas variáveis de ambiente.");
            return;
          }

          try {
            win.google.accounts.id.initialize({
              client_id: clientId,
              callback: handleGoogleCallback,
              auto_select: false,
              cancel_on_tap_outside: true
            });

            const buttonDiv = document.getElementById("googleSignInDiv");
            if (buttonDiv) {
              win.google.accounts.id.renderButton(
                buttonDiv,
                { 
                  theme: "outline", 
                  size: "large", 
                  width: buttonDiv.offsetWidth || 350,
                  text: "signin_with",
                  shape: "rectangular"
                } 
              );
            }
          } catch (e) {
            console.error("Erro ao renderizar botão do Google:", e);
          }
        } else if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initGoogle, 500); // Tenta novamente em 500ms
        }
      };

      // Pequeno delay para garantir que o elemento DOM 'googleSignInDiv' foi montado pelo React
      setTimeout(initGoogle, 100);
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

  const handleConsultCnpj = async () => {
      if (!cnpj || cnpj.length < 14) return;
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(cnpj);
          if (data) {
              let secCnaesStr = '';
              if (data.cnaes_secundarios && Array.isArray(data.cnaes_secundarios)) {
                  secCnaesStr = data.cnaes_secundarios.map((item: any) => `${item.codigo} - ${item.descricao}`).join('\n');
              }

              setCompanyData(prev => ({
                  ...prev,
                  tradeName: data.nome_fantasia || data.razao_social,
                  legalName: data.razao_social,
                  cnae: `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`,
                  secondaryCnaes: secCnaesStr,
                  zipCode: data.cep,
                  street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}`.trim(),
                  number: data.numero,
                  neighborhood: data.bairro,
                  city: data.municipio,
                  state: data.uf,
                  phone: data.ddd_telefone_1,
                  email: data.email
              }));
              
              if (data.nome_fantasia || data.razao_social) setName(data.nome_fantasia || data.razao_social);
              if (data.email && !email) setEmail(data.email.toLowerCase());
          }
      } catch (e) {
          setError("CNPJ não encontrado ou erro na consulta.");
      } finally {
          setLoadingCnpj(false);
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
        const pjPayload = entityType === EntityType.BUSINESS ? { ...companyData, cnpj } : undefined;
        data = await register(name, email, password, entityType, plan, pjPayload);
      }
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'CHECKOUT' || mode === 'REGISTER') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
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

                <div className="p-8 md:w-2/3 max-h-[90vh] overflow-y-auto">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Criar Conta</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button
                                type="button"
                                onClick={() => setEntityType(EntityType.PERSONAL)}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${entityType === EntityType.PERSONAL ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-50'}`}
                            >
                                <UserIcon className="w-5 h-5" />
                                <span className="text-xs font-bold">Pessoa Física</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEntityType(EntityType.BUSINESS)}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${entityType === EntityType.BUSINESS ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-50'}`}
                            >
                                <Briefcase className="w-5 h-5" />
                                <span className="text-xs font-bold">Pessoa Jurídica</span>
                            </button>
                        </div>

                        {entityType === EntityType.BUSINESS && (
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-4 animate-fade-in">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-indigo-800 mb-1">CNPJ (Apenas números)</label>
                                        <input
                                            type="text"
                                            value={cnpj}
                                            onChange={(e) => setCnpj(e.target.value.replace(/\D/g, ''))}
                                            className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="00000000000191"
                                            maxLength={14}
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleConsultCnpj} 
                                        disabled={loadingCnpj || cnpj.length < 14}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loadingCnpj ? '...' : <Search className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Razão Social</label>
                                        <input type="text" value={companyData.legalName} onChange={e => setCompanyData({...companyData, legalName: e.target.value})} className="w-full p-2 rounded border text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Nome Fantasia</label>
                                        <input type="text" value={companyData.tradeName} onChange={e => setCompanyData({...companyData, tradeName: e.target.value})} className="w-full p-2 rounded border text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">CEP</label>
                                        <input type="text" value={companyData.zipCode} onChange={e => setCompanyData({...companyData, zipCode: e.target.value})} className="w-full p-2 rounded border text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
                                        <input type="text" value={companyData.street} onChange={e => setCompanyData({...companyData, street: e.target.value})} className="w-full p-2 rounded border text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Regime Tributário</label>
                                    <select 
                                        value={companyData.taxRegime} 
                                        onChange={e => setCompanyData({...companyData, taxRegime: e.target.value as TaxRegime})}
                                        className="w-full p-2 rounded border text-sm bg-white"
                                    >
                                        <option value={TaxRegime.MEI}>MEI</option>
                                        <option value={TaxRegime.SIMPLES}>Simples Nacional</option>
                                        <option value={TaxRegime.PRESUMIDO}>Lucro Presumido</option>
                                        <option value={TaxRegime.REAL}>Lucro Real</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                {entityType === EntityType.BUSINESS ? 'Nome do Responsável' : 'Nome Completo'}
                            </label>
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
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
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
             
             {/* Contêiner do Botão do Google */}
             <div className="mt-6 flex justify-center min-h-[50px]" id="googleSignInDiv"></div>
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
