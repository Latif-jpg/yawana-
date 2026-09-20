import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Typography } from '@/components/Typography';
import { Button } from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { Colors, Spacing, Radius, Shadows } from '@/constants/Theme';
import { useAuth } from '@/libs/auth';
import { supabase } from '@/libs/supabase';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, X, Phone, Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

function normalizeAuthError(err: any) {
  const message = String(err?.message || '');
  const code = String(err?.code || '');
  const status = Number(err?.status || 0);

  if (message.includes('Invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Veuillez confirmer votre email avant de vous connecter. Verifiez votre boite de reception.';
  }

  if (message.includes('User already registered')) {
    return 'Un compte existe deja avec cet email.';
  }

  if (message.toLowerCase().includes('password should be at least')) {
    return 'Le mot de passe est trop court.';
  }

  if (code === '42703') {
    return 'Erreur de schéma sur la table profiles. Vérifiez les migrations Supabase du profil.';
  }

  if (status === 429) {
    return 'Trop de tentatives. Réessayez dans un instant.';
  }

  if (
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('gateway timeout') ||
    status >= 500
  ) {
    return 'Le serveur Yawana est temporairement indisponible. Vérifiez votre connexion puis réessayez dans quelques instants.';
  }

  return message || 'Une erreur est survenue';
}

export default function LoginScreen() {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const { showToast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [userRole, setUserRole] = useState<'client' | 'seller'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isLoading && session) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isLoading, router, session]);

  const handleAuth = async () => {
    if (!isLogin && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      showToast({
        tone: 'error',
        title: 'Inscription impossible',
        message: 'Les mots de passe ne correspondent pas.',
      });
      return;
    }

    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedPhone = phone.trim();

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) throw signInError;
        showToast({
          tone: 'success',
          title: 'Connexion réussie',
          message: 'Votre session a bien été ouverte.',
        });
      } else {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: normalizedFullName,
              phone: normalizedPhone,
              role: userRole,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.user && data.session?.user?.id === data.user.id) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: normalizedFullName,
            phone: normalizedPhone,
            role: userRole,
          });

          if (profileError) throw profileError;
        }

        showToast({
          tone: 'success',
          title: 'Compte créé',
          message: 'Votre compte a été créé. Vérifiez vos emails si nécessaire.',
          durationMs: 4200,
        });
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const message = normalizeAuthError(err);
      setError(message);
      showToast({
        tone: 'error',
        title: isLogin ? 'Connexion impossible' : 'Inscription impossible',
        message,
        durationMs: 4200,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000&auto=format&fit=crop' }}
        style={styles.background}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <X color={Colors.white} size={24} />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 60 }}>
            <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
              <Typography variant="h1" color={Colors.white} style={styles.title}>
                Yawana
              </Typography>
              <Typography variant="body" color={Colors.white + 'CC'} style={styles.subtitle}>
                {isLogin ? 'Heureux de vous revoir !' : 'Rejoignez le radar des marchés'}
              </Typography>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(800)} style={styles.glassCard}>
              {error ? (
                <View style={styles.errorBox}>
                  <Typography variant="caption" color={Colors.error} style={{ fontWeight: '600' }}>
                    {error}
                  </Typography>
                </View>
              ) : null}

              {!isLogin ? (
                <>
                  <View style={[styles.inputContainer, styles.authInputContainer]}>
                    <User size={20} color={Colors.white} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Nom complet"
                      placeholderTextColor="rgba(255,255,255,0.65)"
                      autoComplete="name"
                      selectionColor={Colors.primary}
                      style={[styles.input, styles.authInput]}
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.authInputContainer]}>
                    <Phone size={20} color={Colors.white} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Numéro de téléphone"
                      placeholderTextColor="rgba(255,255,255,0.65)"
                      keyboardType="phone-pad"
                      selectionColor={Colors.primary}
                      style={[styles.input, styles.authInput]}
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>

                  <View style={styles.roleContainer}>
                    <Typography variant="label" style={{ marginBottom: 12 }}>
                      Je suis un :
                    </Typography>
                    <View style={styles.rolePicker}>
                      <TouchableOpacity
                        style={[styles.roleBtn, userRole === 'client' && styles.roleBtnActive]}
                        onPress={() => setUserRole('client')}
                      >
                        <Typography variant="caption" color={userRole === 'client' ? Colors.white : Colors.text}>
                          Acheteur / Client
                        </Typography>
                        {userRole === 'client' ? (
                          <CheckCircle2 size={16} color={Colors.white} style={{ marginLeft: 8 }} />
                        ) : null}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.roleBtn, userRole === 'seller' && styles.roleBtnActive]}
                        onPress={() => setUserRole('seller')}
                      >
                        <Typography variant="caption" color={userRole === 'seller' ? Colors.white : Colors.text}>
                          Vendeur / Commerçant
                        </Typography>
                        {userRole === 'seller' ? (
                          <CheckCircle2 size={16} color={Colors.white} style={{ marginLeft: 8 }} />
                        ) : null}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : null}

              <View style={[styles.inputContainer, styles.authInputContainer]}>
                <Mail size={20} color={Colors.white} style={styles.inputIcon} />
                <TextInput
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  selectionColor={Colors.primary}
                  style={[styles.input, styles.authInput]}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={[styles.inputContainer, styles.passwordContainer]}>
                <Lock size={20} color={Colors.white} style={styles.inputIcon} />
                <TextInput
                  placeholder="Mot de passe"
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  autoComplete="password"
                  textContentType="password"
                  selectionColor={Colors.primary}
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}>
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.white} />
                  ) : (
                    <Eye size={20} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>

              {!isLogin ? (
                <View style={[styles.inputContainer, styles.passwordContainer]}>
                  <Lock size={20} color={Colors.white} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    autoComplete="password"
                    textContentType="password"
                    selectionColor={Colors.primary}
                    secureTextEntry={!showPassword}
                    style={[styles.input, styles.passwordInput]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              ) : null}

              {isLogin ? (
                <TouchableOpacity style={styles.forgotPass}>
                  <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '600' }}>
                    Mot de passe oublié ?
                  </Typography>
                </TouchableOpacity>
              ) : null}

              <Button
                title={isLogin ? 'Se connecter' : 'Créer mon compte'}
                onPress={handleAuth}
                disabled={loading}
                loading={loading}
                style={styles.authBtn}
              />

              <View style={styles.footer}>
                <Typography variant="body" color={Colors.textSecondary}>
                  {isLogin ? 'Pas encore de compte ?' : 'Déjà membre ?'}
                </Typography>
                <TouchableOpacity
                  onPress={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                >
                  <Typography variant="body" color={Colors.primary} style={{ fontWeight: 'bold', marginLeft: 8 }}>
                    {isLogin ? 'Inscrivez-vous' : 'Connectez-vous'}
                  </Typography>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  background: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  keyboardView: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.premium,
  },
  errorBox: {
    backgroundColor: Colors.error + '15',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  authInputContainer: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  passwordContainer: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  authInput: {
    color: Colors.white,
  },
  passwordInput: {
    color: Colors.white,
  },
  passwordToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  roleContainer: {
    marginBottom: 24,
  },
  rolePicker: {
    flexDirection: 'row',
    gap: 12,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  authBtn: {
    height: 56,
    borderRadius: Radius.md,
    marginTop: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
});

