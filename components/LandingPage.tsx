
import React from 'react';
import { Check, Shield, TrendingUp, Users, ArrowRight, Wallet, Briefcase } from 'lucide-react';
import { EntityType, SubscriptionPlan } from '../types';

interface LandingPageProps {
  onGetStarted: (type: EntityType, plan: SubscriptionPlan) => void;
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Navbar */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Wallet className="w-8 h-8 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">FinManager</span>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={onLogin}
                className="text-gray-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Entrar
              </button>
              <button 
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Começar Grátis
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
            Controle financeiro inteligente para <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">você e sua empresa</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Organize suas contas, preveja seu saldo futuro e tome decisões melhores com nosso consultor IA.
            Ideal para Pessoa Física e Jurídica.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <button 
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2"
            >
                Experimente Grátis
                <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-gray-50 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all border border-gray-200">
                Ver Funcionalidades
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Tudo o que você precisa</h2>
            <p className="text-gray-500">Uma plataforma completa para gestão financeira moderna.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                    <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Visão de Futuro</h3>
                <p className="text-gray-500">Não olhe apenas o passado. Projete seu saldo futuro com base em contas a pagar e receber recorrentes.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 text-emerald-600">
                    <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">PF e PJ Integrados</h3>
                <p className="text-gray-500">Gerencie suas finanças pessoais e empresariais em ambientes separados, mas com a mesma facilidade.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6 text-purple-600">
                    <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Colaboração Familiar</h3>
                <p className="text-gray-500">Convide seu sócio ou cônjuge para visualizar e gerenciar as finanças em conjunto em tempo real.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Planos Transparentes</h2>
            <p className="text-gray-500">Comece com 15 dias de teste grátis. Cancele quando quiser.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Pessoa Física */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 hover:border-indigo-300 transition-all hover:shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-gray-100 px-4 py-1 rounded-bl-xl text-xs font-bold text-gray-600">
                    PARA VOCÊ
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pessoa Física</h3>
                <p className="text-gray-500 mb-6">Controle total das finanças domésticas.</p>
                
                <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">R$ 29</span>
                    <span className="text-gray-500">/mês</span>
                </div>

                <ul className="space-y-3 mb-8">
                    <li className="flex gap-3 text-gray-600"><Check className="w-5 h-5 text-indigo-500" /> Contas Ilimitadas</li>
                    <li className="flex gap-3 text-gray-600"><Check className="w-5 h-5 text-indigo-500" /> Consultor IA Gemini</li>
                    <li className="flex gap-3 text-gray-600"><Check className="w-5 h-5 text-indigo-500" /> Compartilhamento Familiar</li>
                </ul>

                <button 
                    onClick={() => onGetStarted(EntityType.PERSONAL, SubscriptionPlan.MONTHLY)}
                    className="w-full py-3 rounded-xl font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                    Começar Teste Grátis (PF)
                </button>
            </div>

            {/* Pessoa Jurídica */}
            <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800 text-white relative overflow-hidden hover:shadow-2xl transition-all">
                <div className="absolute top-0 right-0 bg-indigo-500 px-4 py-1 rounded-bl-xl text-xs font-bold text-white">
                    MAIS POPULAR
                </div>
                <h3 className="text-2xl font-bold mb-2">Pessoa Jurídica</h3>
                <p className="text-gray-400 mb-6">Gestão profissional para o seu negócio.</p>
                
                <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold">R$ 49</span>
                    <span className="text-gray-400">/mês</span>
                </div>

                <ul className="space-y-3 mb-8">
                    <li className="flex gap-3 text-gray-300"><Check className="w-5 h-5 text-emerald-400" /> Tudo do plano Pessoal</li>
                    <li className="flex gap-3 text-gray-300"><Check className="w-5 h-5 text-emerald-400" /> Múltiplos Sócios</li>
                    <li className="flex gap-3 text-gray-300"><Check className="w-5 h-5 text-emerald-400" /> Relatórios de Fluxo de Caixa</li>
                    <li className="flex gap-3 text-gray-300"><Check className="w-5 h-5 text-emerald-400" /> Suporte Prioritário</li>
                </ul>

                <button 
                    onClick={() => onGetStarted(EntityType.BUSINESS, SubscriptionPlan.MONTHLY)}
                    className="w-full py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/50"
                >
                    Começar Teste Grátis (PJ)
                </button>
            </div>

          </div>
          
          <div className="mt-8 text-center">
             <button 
                onClick={() => onGetStarted(EntityType.BUSINESS, SubscriptionPlan.YEARLY)}
                className="text-sm text-gray-500 hover:text-indigo-600 underline"
             >
                 Ver planos anuais com desconto
             </button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-indigo-600 opacity-50" />
              <span className="font-bold text-gray-700">FinManager</span>
            </div>
            <p className="text-sm text-gray-500">© 2024 FinManager SaaS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
