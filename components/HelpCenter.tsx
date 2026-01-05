
import React, { useState } from 'react';
import { HelpCircle, Search, ChevronDown, ChevronUp, Glasses, DollarSign, Stethoscope, Settings, PlayCircle, BookOpen, MessageSquare, ExternalLink, Zap } from 'lucide-react';
import { useHelp } from './GuidedHelp';

interface FAQItem {
    id: string;
    question: string;
    answer: React.ReactNode;
    category: 'FINANCE' | 'OPTICAL' | 'ODONTO' | 'GENERAL' | 'ADMIN';
}

const FAQS: FAQItem[] = [
    // FINANCEIRO
    {
        id: 'fin_1',
        category: 'FINANCE',
        question: 'Como lançar uma despesa recorrente?',
        answer: 'Ao criar um novo lançamento, marque a opção "Repetir Lançamento". Escolha a frequência (Mensal, Semanal) e, se desejar, uma data de término.'
    },
    {
        id: 'fin_2',
        category: 'FINANCE',
        question: 'Como funciona o saldo projetado?',
        answer: 'O saldo projetado considera seu saldo atual em contas + todas as receitas pendentes - todas as despesas pendentes até o final do filtro de data selecionado.'
    },
    {
        id: 'fin_3',
        category: 'FINANCE',
        question: 'Posso cadastrar cartões de crédito?',
        answer: 'Sim! Vá em Contas > Adicionar Conta > Tipo "Cartão de Crédito". Defina o limite e o dia de fechamento para controle automático de faturas.'
    },
    // ÓTICA
    {
        id: 'opt_1',
        category: 'OPTICAL',
        question: 'Como cadastrar uma Receita (RX)?',
        answer: 'Acesse o menu "Receitas RX", clique em "Nova Receita". Preencha os dados esféricos, cilíndricos e eixos. Você pode vincular a um cliente existente ou criar um novo.'
    },
    {
        id: 'opt_2',
        category: 'OPTICAL',
        question: 'Como enviar um pedido para o laboratório?',
        answer: 'Dentro de uma Receita salva, ou na tela de Vendas, selecione a opção "Vincular Laboratório". Escolha o laboratório parceiro e clique nos botões de WhatsApp ou E-mail para enviar o pedido formatado.'
    },
    // ODONTO
    {
        id: 'odo_1',
        category: 'ODONTO',
        question: 'Como marcar procedimentos no Odontograma?',
        answer: 'No perfil do paciente, vá na aba "Odontograma". Clique no dente desejado e selecione a condição (Cárie, Restauração, etc). Isso atualizará o visual automaticamente.'
    },
    // GERAL
    {
        id: 'gen_1',
        category: 'GENERAL',
        question: 'Como convidar alguém para minha equipe?',
        answer: 'Vá em Configurações > Gestão de Acesso. Clique em "Convidar Novo Membro" e envie o código gerado para a pessoa. Ela deverá usar a opção "Entrar em Equipe" na tela inicial.'
    },
    {
        id: 'gen_2',
        category: 'ADMIN',
        question: 'Como alterar meu plano?',
        answer: 'Entre em contato com o suporte ou acesse a área de Configurações > Ajustes para visualizar as opções de upgrade disponíveis.'
    }
];

const HelpCenter: React.FC = () => {
    const { startGuide } = useHelp();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'FINANCE' | 'OPTICAL' | 'ODONTO' | 'GENERAL'>('ALL');
    const [openQuestion, setOpenQuestion] = useState<string | null>(null);

    const filteredFaqs = FAQS.filter(f => {
        const matchesCategory = selectedCategory === 'ALL' || f.category === selectedCategory || (selectedCategory === 'GENERAL' && f.category === 'ADMIN');
        const matchesSearch = f.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (typeof f.answer === 'string' && f.answer.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const categories = [
        { id: 'ALL', label: 'Tudo', icon: BookOpen, color: 'bg-slate-100 text-slate-600' },
        { id: 'FINANCE', label: 'Financeiro', icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
        { id: 'OPTICAL', label: 'Ótica', icon: Glasses, color: 'bg-indigo-100 text-indigo-600' },
        { id: 'ODONTO', label: 'Odonto', icon: Stethoscope, color: 'bg-sky-100 text-sky-600' },
        { id: 'GENERAL', label: 'Geral & Admin', icon: Settings, color: 'bg-amber-100 text-amber-600' },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-20 max-w-5xl mx-auto">
            <div className="text-center space-y-4 py-8">
                <div className="inline-flex p-4 bg-indigo-600 rounded-[2rem] shadow-xl mb-2">
                    <HelpCircle className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Central de Ajuda</h1>
                <p className="text-gray-500 font-medium max-w-xl mx-auto">
                    Tire suas dúvidas, aprenda a usar as ferramentas e domine o sistema com nossos guias interativos.
                </p>
                
                <div className="relative max-w-md mx-auto mt-6">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Qual sua dúvida hoje?" 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                    />
                </div>
            </div>

            {/* Tours Interativos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" /> Tours Interativos
                    </h3>
                </div>
                
                <button onClick={() => startGuide('OPTICAL')} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all text-left group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Glasses className="w-16 h-16 text-indigo-600" />
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Fluxo de Ótica</h4>
                    <p className="text-xs text-gray-500 mb-4">Aprenda a cadastrar receitas e gerar vendas.</p>
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Iniciar Tour →</span>
                </button>

                <button onClick={() => { /* Placeholder for generic tour */ }} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all text-left group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 h-16 text-emerald-600" />
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Gestão Financeira</h4>
                    <p className="text-xs text-gray-500 mb-4">Como categorizar e analisar seus gastos.</p>
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Em Breve</span>
                </button>

                <button onClick={() => { /* Placeholder for contact tour */ }} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all text-left group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Stethoscope className="w-16 h-16 text-sky-600" />
                    </div>
                    <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600 mb-4 group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Odontologia</h4>
                    <p className="text-xs text-gray-500 mb-4">Prontuário e Odontograma interativo.</p>
                    <span className="text-[10px] font-black uppercase text-sky-600 tracking-widest">Em Breve</span>
                </button>
            </div>

            {/* Categorias e FAQ */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id as any)}
                                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wide transition-all ${selectedCategory === cat.id ? cat.color : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                <cat.icon className="w-4 h-4" />
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {filteredFaqs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="font-medium">Nenhuma pergunta encontrada para sua busca.</p>
                        </div>
                    ) : filteredFaqs.map(faq => (
                        <div key={faq.id} className="group">
                            <button 
                                onClick={() => setOpenQuestion(openQuestion === faq.id ? null : faq.id)}
                                className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${faq.category === 'FINANCE' ? 'bg-emerald-100 text-emerald-600' : faq.category === 'OPTICAL' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-gray-800 text-sm">{faq.question}</span>
                                </div>
                                {openQuestion === faq.id ? <ChevronUp className="w-5 h-5 text-indigo-500" /> : <ChevronDown className="w-5 h-5 text-gray-300" />}
                            </button>
                            {openQuestion === faq.id && (
                                <div className="px-6 pb-6 pl-14 animate-fade-in">
                                    <p className="text-sm text-gray-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        {faq.answer}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Rodapé de Suporte */}
            <div className="bg-indigo-900 rounded-[2rem] p-8 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="relative z-10">
                    <h3 className="text-xl font-black mb-2">Ainda precisa de ajuda?</h3>
                    <p className="text-indigo-200 text-sm mb-6 max-w-lg mx-auto">Nossa equipe de suporte está disponível para resolver problemas complexos ou dúvidas sobre sua conta.</p>
                    <div className="flex justify-center gap-4">
                        <button className="bg-white text-indigo-900 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" /> Chat Suporte
                        </button>
                        <a href="mailto:suporte@finmanager.com" className="bg-indigo-800 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" /> Enviar Email
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenter;
