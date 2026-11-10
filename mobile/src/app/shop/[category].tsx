// Deep link parity with the website's /shop/:category → the Shop tab filtered to that stall.
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ShopCategoryLink() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return <Redirect href={{ pathname: '/shop', params: { category } }} />;
}
