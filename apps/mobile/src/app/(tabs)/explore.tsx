import { type Href, Redirect } from 'expo-router';

export default function ExploreScreen() {
  return <Redirect href={'/discover' as Href} />;
}
