import { Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { LayoutGrid, PlusCircle, Store, User } from 'lucide-react-native';

import { Colors, Layout } from '@/constants/Theme';

const renderTabButton = (props: any) => (
  <Pressable
    onPress={props.onPress}
    onLongPress={props.onLongPress}
    accessibilityState={props.accessibilityState}
    style={({ pressed }) => [
      styles.tabButton,
      props.accessibilityState?.selected && styles.tabButtonActive,
      pressed && styles.tabButtonPressed,
    ]}
  >
    {props.children}
  </Pressable>
);

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textSecondary,
      tabBarStyle: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Layout.tabBarBottom,
        height: Layout.tabBarHeight,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: Colors.glass,
        borderTopColor: Colors.border,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 26,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
      },
      tabBarItemStyle: {
        paddingTop: 0,
        paddingBottom: 0,
      },
      tabBarLabelStyle: {
        marginTop: 0,
        fontSize: 10,
        fontWeight: '700',
      },
      tabBarShowLabel: true,
      headerShown: false, // On utilise nos propres headers pour le style Apple
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color }) => <LayoutGrid color={color} size={24} />,
          tabBarButton: renderTabButton,
        }}
      />
      <Tabs.Screen
        name="add-price"
        options={{
          title: 'Ajouter',
          tabBarIcon: ({ color }) => <PlusCircle color={color} size={24} />,
          tabBarButton: renderTabButton,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Boutiques',
          tabBarIcon: ({ color }) => <Store color={color} size={24} />,
          tabBarButton: renderTabButton,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Ma boutique',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
          tabBarButton: renderTabButton,
        }}
      />
    </Tabs>
  );
}

const styles = {
  tabButton: {
    flex: 1,
    borderRadius: 20,
    marginHorizontal: 4,
    marginVertical: 4,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabButtonPressed: {
    opacity: 0.9,
  },
  tabLabelWrap: {
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: Colors.white,
  },
} as const;
