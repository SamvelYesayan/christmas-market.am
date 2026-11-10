import { useLocalSearchParams } from 'expo-router';
import { RegisterForm } from '@/features/auth/AuthForm';

export default function Register() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return <RegisterForm next={next} />;
}
