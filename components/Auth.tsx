
import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Briefcase, User as UserIcon, CheckCircle, Search, Rocket, Loader2 } from 'lucide-react';
import { login, register, loginWithGoogle, consultCnpj } from '../services/storageService';
import { User, EntityType, SubscriptionPlan, TaxRegime } from '../types';
import { useAlert } from './AlertSystem';

interface AuthProps {
  onLoginSuccess: (user: User) => void;
  initialMode?: 'LOGIN' | 'REGISTER';
  initialEntityType?: EntityType;
  initialPlan?: SubscriptionPlan;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess, initialMode = 'LOGIN', initialEntityType = EntityType.PERSONAL, initialPlan = SubscriptionPlan.MONTHLY }) => {
  const { showAlert } = useAlert();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'CHECKOUT'>(initialMode === 'REGISTER' ? 'CHECKOUT' : 'LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<EntityType>(initialEntityType);
  const [plan, setPlan] = useState<SubscriptionPlan>(initialPlan);
  
  const [cnpj, setCnpj] = useState('');
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [companyData, setCompanyData] = useState({
      tradeName: '', legalName: '', cnae: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '', phone: '', email: '',
      taxRegime: TaxRegime.SIMPLES, hasEmployees: false, issuesInvoices: false
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const registrationContext = useRef({ entityType, cnpj, companyData });
  useEffect(() => { registrationContext.current = { entityType, cnpj, companyData }; }, [entityType, cnpj, companyData]);

  useEffect(() => {
    const win = window as any;
    const clientId = win.GOOGLE_CLIENT_ID && win.GOOGLE_CLIENT_ID !== "__GOOGLE_CLIENT_ID__" ? win.GOOGLE_CLIENT_ID : "";
    
    const initGoogle = () => {
      if (win.google?.accounts?.id && clientId) {
        try {
          win.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          renderGoogleButtons();
        } catch (e) {
          console.error("Erro ao inicializar Google Login:", e);
        }
      } else {
        // Tenta novamente em 500ms caso o script da Google ainda esteja carregando
        setTimeout(initGoogle, 500);
      }
    };

    const renderGoogleButtons = () => {
        const loginDiv = document.getElementById("googleSignInDiv");
        const registerDiv = document.getElementById("googleSignUpDiv");
        if (loginDiv) win.google.accounts.id.renderButton(loginDiv, { theme: "outline", size: "large", width: 350, text: "signin_with" });
        if (registerDiv) win.google.accounts.id.renderButton(registerDiv, { theme: "outline", size: "large", width: 350, text: "signup_with" });
    };

    initGoogle();
  }, [mode]);

  const handleGoogleCallback = async (response: any) => {
    setLoading(true);
    setError('');
    const { entityType: currentType, cnpj: currentCnpj, companyData: currentPJ } = registrationContext.current;
    
    if ((mode === 'REGISTER' || mode === 'CHECKOUT') && currentType === EntityType.BUSINESS && !currentCnpj) {
        setError("Para criar uma conta jurídica com o Google, informe o CNPJ primeiro.");
        setLoading(false);
        return;
    }
    
    try {
        const pjPayload = currentType === EntityType.BUSINESS ? { ...currentPJ, cnpj: currentCnpj } : undefined;
        const data = await loginWithGoogle(response.credential, currentType, pjPayload);
        onLoginSuccess(data.user);
    } catch (err: any) {
        setError(err.message || 'Erro ao processar login com Google.');
    } finally { setLoading(false); }
  };

  const handleConsultCnpj = async () => {
      if (!cnpj || cnpj.length < 14) return;
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(cnpj);
          if (data) {
              setCompanyData(prev => ({
                  ...prev,
                  tradeName: data.nome_fantasia || data.razao_social,
                  legalName: data.razao_social,
                  cnae: `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`,
                  zipCode: data.cep,
                  street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}`.trim(),
                  number: data.numero,
                  neighborhood: data.bairro,
                  city: data.municipio,
                  state: data.uf,
                  phone: data.ddd_telefone_1,
                  email: data.email
              }));
          }
      } catch (e) { setError("Erro ao consultar CNPJ."); }
      finally { setLoadingCnpj(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'LOGIN') {
        const data = await login(email, password);
        onLoginSuccess(data.user);
      } else {
        const pjPayload = entityType === EntityType.BUSINESS ? { ...companyData, cnpj } : undefined;
        const data = await register(name, email, password, entityType, plan, pjPayload);
        onLoginSuccess(data.user);
        showAlert("Conta criada! Você tem 15 dias de teste grátis.", "success");
      }
    } catch (err: any) {
      setError(err.message || 'Erro na autenticação.');
      setLoading(false);
    }
  };

  if (mode === 'CHECKOUT' || mode === 'REGISTER') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row animate-scale-up">
                <div className="bg-slate-900 p-8 text-white md:w-1/3 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-4">Registro Grátis</h2>
                        <div className="space-y-4">
                            <div className="bg-white/10 p-4 rounded-xl">
                                <p className="text-xs text-gray-400 uppercase font-bold">Modalidade</p>
                                <p className="text-lg font-bold text-indigo-400">{entityType === EntityType.PERSONAL ? 'Pessoa Física' : 'Pessoa Jurídica'}</p>
                                <p className="text-sm text-gray-300">15 Dias de Teste Grátis</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                                <p className="text-xs text-emerald-400 font-bold uppercase mb-1">Promoção de Lançamento</p>
                                <p className="text-sm text-gray-200">Acesso total liberado sem cartão de crédito.</p>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" /><span>Garantia de segurança</span></div>
                        </div>
                    </div>
                </div>
                <div className="p-8 md:w-2/3 max-h-[90vh] overflow-y-auto">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Criar sua Conta</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button type="button" onClick={() => setEntityType(EntityType.PERSONAL)} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${entityType === EntityType.PERSONAL ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200'}`}><UserIcon className="w-5 h-5" /><span className="text-xs font-bold">Pessoa Física</span></button>
                            <button type="button" onClick={() => setEntityType(EntityType.BUSINESS)} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${entityType === EntityType.BUSINESS ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200'}`}><Briefcase className="w-5 h-5" /><span className="text-xs font-bold">Pessoa Jurídica</span></button>
                        </div>
                        {entityType === EntityType.BUSINESS && (
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-4 animate-fade-in">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1"><label className="block text-xs font-bold text-indigo-800 mb-1">CNPJ</label><input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value.replace(/\D/g, ''))} className="w-full px-3 py-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Apenas números" maxLength={14} /></div>
                                    <button type="button" onClick={handleConsultCnpj} disabled={loadingCnpj || cnpj.length < 14} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"><Search className="w-4 h-4" /></button>
                                </div>
                                {companyData.legalName && <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{companyData.legalName}</p>}
                            </div>
                        )}
                        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nome Completo" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="seu@email.com" />
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Senha" />
                        {error && <div className="text-rose-600 text-sm bg-rose-50 p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
                        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                            {loading ? 'Processando...' : 'Finalizar e Começar Agora'}
                        </button>
                        <div className="py-4 flex items-center gap-4"><div className="h-px bg-gray-100 flex-1"></div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ou use sua rede social</span><div className="h-px bg-gray-100 flex-1"></div></div>
                        <div className="flex justify-center min-h-[50px]" id="googleSignUpDiv"></div>
                        <div className="text-center mt-4"><button type="button" onClick={() => setMode('LOGIN')} className="text-sm text-indigo-600 hover:underline">Já tenho conta</button></div>
                    </form>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-8 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">FinManager</h1>
            <p className="text-gray-500 mt-2">Bem-vindo de volta</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="seu@email.com" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Senha" />
            {error && <div className="text-rose-600 text-sm bg-rose-50 p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg">{loading ? 'Entrando...' : 'Entrar'}</button>
          </form>
          <div className="mt-6"><div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Ou continue com</span></div></div><div className="mt-6 flex justify-center min-h-[50px]" id="googleSignInDiv"></div></div>
          <div className="mt-6 text-center"><button onClick={() => setMode('REGISTER')} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Não tem conta? Cadastre-se grátis</button></div>
      </div>
    </div>
  );
};

export default Auth;
