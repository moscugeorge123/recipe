import { type Href, Redirect } from 'expo-router';

export default function PantryScreen() {
  return <Redirect href={'/groceries' as Href} />;
}
