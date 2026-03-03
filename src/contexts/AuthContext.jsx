/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext(null);

export const ROLES = {
    ADMIN: 'ADMIN',
    LIDER: 'LIDER',
    COLABORADOR: 'COLABORADOR',
    FUNCIONARIO_POSTO: 'FUNCIONARIO_POSTO'
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [bootstrapping, setBootstrapping] = useState(true);
    const [loading, setLoading] = useState(false);

    const fetchUserProfile = async (sessionUser) => {
        if (!sessionUser) return;

        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, companies(name)')
                .eq('id', sessionUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Erro ao buscar perfil:', error);
            }

            setUser({
                id: sessionUser.id,
                email: profile?.email || sessionUser.email,
                name: profile?.full_name || sessionUser.user_metadata?.full_name || 'Usuário',
                role: profile?.role || sessionUser.user_metadata?.role || ROLES.COLABORADOR,
                company: profile?.companies?.name || sessionUser.user_metadata?.company,
                company_id: profile?.company_id || sessionUser.user_metadata?.company_id,
                station_id: profile?.station_id || sessionUser.user_metadata?.station_id
            });
        } catch (err) {
            console.error('Falha crítica ao buscar perfil:', err);
            // Fallback para não travar a aplicação em tela branca/carregando
            setUser({
                id: sessionUser.id,
                email: sessionUser.email,
                name: sessionUser.user_metadata?.full_name || 'Usuário (sem perfil)',
                role: sessionUser.user_metadata?.role || ROLES.COLABORADOR,
                company_id: sessionUser.user_metadata?.company_id,
                station_id: sessionUser.user_metadata?.station_id
            });
        }
    };

    useEffect(() => {
        if (!supabase) {
            setBootstrapping(false);
            return;
        }

        const getSession = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) {
                    console.warn('Erro ao obter sessão:', sessionError.message);
                }

                if (session?.user) {
                    const meta = session.user.user_metadata;
                    // Define estado otimista para entrar rápido
                    setUser({
                        id: session.user.id,
                        email: session.user.email,
                        name: meta?.full_name || 'Usuário',
                        role: meta?.role || ROLES.COLABORADOR,
                        company_id: meta?.company_id,
                        station_id: meta?.station_id
                    });
                    // Busca perfil completo em segundo plano
                    fetchUserProfile(session.user);
                }
            } catch (err) {
                console.error('Erro crítico ao recuperar sessão:', err);
            } finally {
                setBootstrapping(false);
            }
        };

        const timeout = setTimeout(() => {
            if (bootstrapping) {
                console.warn('AuthContext: timeout atingido ao carregar sessão.');
                setBootstrapping(false);
            }
        }, 5000);

        getSession();

        const { data: { subscription } } = supabase ? supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            try {
                if (session?.user) {
                    const meta = session.user.user_metadata;
                    setUser({
                        id: session.user.id,
                        email: session.user.email,
                        name: meta?.full_name || 'Usuário',
                        role: meta?.role || ROLES.COLABORADOR,
                        company_id: meta?.company_id,
                        station_id: meta?.station_id
                    });
                    fetchUserProfile(session.user);
                } else {
                    setUser(null);
                }
            } finally {
                setBootstrapping(false);
            }
        }) : { data: { subscription: { unsubscribe: () => { } } } };

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        if (!supabase) return { success: false, message: 'Banco de dados não configurado.' };

        try {
            setLoading(true);
            const loginPromise = supabase.auth.signInWithPassword({
                email,
                password,
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), 20000)
            );

            const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

            if (error) {
                console.error('Erro no login:', error);
                setLoading(false);
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, message: 'E-mail ou senha inválidos. Verifique seus dados ou cadastre-se.' };
                }
                return { success: false, message: error.message };
            }

            if (data?.user) {
                const meta = data.user.user_metadata;
                // Define estado otimista vindo do metadata para liberar o FleetContext AGORA
                setUser({
                    id: data.user.id,
                    email: data.user.email,
                    name: meta?.full_name || 'Usuário',
                    role: meta?.role || ROLES.COLABORADOR,
                    company_id: meta?.company_id,
                    station_id: meta?.station_id
                });

                // Dispara busca do perfil completo (nome da empresa, etc) sem dar await 
                // para que a navegação para o dashboard ocorra instantaneamente
                fetchUserProfile(data.user);
            }

            setLoading(false);
            return { success: true };
        } catch (err) {
            console.error('Falha no processo de login:', err);
            setLoading(false);
            if (err.message === 'TIMEOUT') {
                return { success: false, message: 'Tempo de resposta esgotado. Verifique sua conexão ou tente novamente.' };
            }
            return { success: false, message: 'Erro inesperado ao entrar no sistema.' };
        }
    };

    const logout = async () => {
        if (!supabase) {
            setUser(null);
            return;
        }
        await supabase.auth.signOut();
        setUser(null);
    };

    const registerUser = async (name, email, phone, password, role, companyName) => {
        if (!supabase) return { success: false, message: 'Banco de dados não configurado.' };
        console.log('Iniciando registro para:', { email, role, companyName });

        let companyId = null;

        // Criar empresa se for ADMIN ou se um nome de empresa foi fornecido e o papel é LIDER
        // (Isso permite que o primeiro usuário da empresa seja um LIDER se desejar)
        if (companyName && (role === ROLES.ADMIN || role === ROLES.LIDER)) {
            try {
                const { data: company, error: compError } = await supabase
                    .from('companies')
                    .insert([{ name: companyName }])
                    .select()
                    .single();

                if (compError) {
                    console.error('Erro ao criar empresa:', compError);
                    return { success: false, message: `Erro ao criar empresa: ${compError.message}` };
                }

                if (!company) {
                    return { success: false, message: 'Falha ao obter ID da empresa criada.' };
                }

                companyId = company.id;
                console.log('Empresa criada com ID:', companyId);
            } catch (err) {
                console.error('Exceção ao criar empresa:', err);
                return { success: false, message: 'Erro inesperado ao criar empresa.' };
            }
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    phone: phone,
                    role: role,
                    company: companyName,
                    company_id: companyId
                }
            }
        });

        if (error) {
            console.error('Erro no signUp (detalhes):', error);
            if (error.message.includes('rate limit')) {
                return { success: false, message: 'Limite de e-mails atingido. Desative a confirmação de e-mail no Supabase.' };
            }
            if (error.message.includes('already registered') || error.code === 'user_already_exists') {
                return {
                    success: false,
                    message: 'Este e-mail já possui uma conta no Supabase Auth. Se você limpou o banco, lembre-se de deletar também o usuário na aba "Authentication" do painel do Supabase.'
                };
            }
            return { success: false, message: error.message };
        }

        console.log('Usuário registrado com sucesso:', data.user?.id);

        // Se a confirmação de e-mail estiver DESATIVADA, o signUp retorna uma sessão imediatamente
        const session = data?.session;

        return {
            success: true,
            needsConfirmation: !session,
            message: session ? 'Cadastro realizado com sucesso! Entrando...' : 'Cadastro realizado! Por favor, verifique seu e-mail para confirmar a conta.'
        };
    };

    const registerCompanyAdmin = async (companyName, adminName, email, password) => {
        return registerUser(adminName, email, '', password, ROLES.ADMIN, companyName);
    };

    const inviteUser = async (name, email, role, customPassword = '', stationId = null) => {
        if (!user?.company_id) return { success: false, message: 'Você precisa estar vinculado a uma empresa para convidar.' };

        // WORKAROUND: Para evitar dependência de Admin API/Edge Functions,
        // criamos um cliente temporário para registrar o novo usuário.
        // Isso simula um "cadastro" feito por outra pessoa.
        const tempSupabase = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        const finalPassword = customPassword || (Math.random().toString(36).slice(-8) + '!');
        console.log(`Convidando ${email} com senha: ${finalPassword}`);

        const { data, error } = await tempSupabase.auth.signUp({
            email,
            password: finalPassword,
            options: {
                data: {
                    full_name: name,
                    role: role,
                    company_id: user.company_id,
                    station_id: stationId
                }
            }
        });

        if (error) {
            console.error('Erro ao convidar usuário:', error);
            if (error.message.includes('already registered')) {
                return { success: false, message: 'Este e-mail já possui uma conta no sistema.' };
            }
            return { success: false, message: error.message };
        }

        return {
            success: true,
            temporaryPassword: finalPassword,
            message: 'Membro da equipe criado com sucesso!'
        };
    };

    const getCompanyUsers = async () => {
        if (!user?.company_id) return [];
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', user.company_id);

        if (error) {
            console.error('Error fetching team:', error);
            return [];
        }

        return data.map(p => ({
            id: p.id,
            name: p.full_name,
            email: p.email,
            role: p.role,
            phone: p.phone,
            station_id: p.station_id
        }));
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            registerCompanyAdmin,
            registerUser,
            inviteUser,
            getCompanyUsers,
            isAuthenticated: !!user,
            loading,
            bootstrapping
        }}>
            {!bootstrapping && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
