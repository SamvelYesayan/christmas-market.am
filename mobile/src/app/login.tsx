import { useLocalSearchParams } from 'expo-router';
import { LoginForm } from '@/features/auth/AuthForm';

export default function Login() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return <LoginForm next={next} />;
}
