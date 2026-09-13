import { type Href, Redirect } from 'expo-router';

export default function YouScreen() {
  return <Redirect href={'/profile' as Href} />;
}
