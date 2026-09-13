import { type Href, Redirect } from 'expo-router';

export default function ShopScreen() {
  return <Redirect href={'/groceries' as Href} />;
}
