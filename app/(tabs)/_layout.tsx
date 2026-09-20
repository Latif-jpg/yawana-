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
      tabBarActiveTintColor: Colors.primaryLight,
      tabBarInactiveTintColor: Colors.textSecondary,
      tabBarStyle: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Layout.tabBarBottom,
        height: Layout.tabBarHeight,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: Colors.card,
        borderTopColor: Colors.border,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 26,
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      },
      tabBarItemStyle: {
        paddingTop: 0,
        paddingBottom: 0,
      },
      tabBarLabelStyle: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '700',
      },
      tabBarShowLabel: true,
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color }) => <LayoutGrid color={color} size={22} />,
          tabBarButton: renderTabButton,
        }}
      />
      <Tabs.Screen
        name="add-price"
        options={{
          title: 'Ajouter',
          tabBarIcon: ({ color }) => <PlusCircle color={color} size={22} />,
          tabBarButton: renderTabButton,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Boutiques',
          tabBarIcon: ({ color }) => <Store color={color} size={22} />,
          tabBarButton: renderTabButton,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Ma boutique',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
          tabBarButton: renderTabButton,
        }}
      />
    </Tabs>
  );
}

const styles = {
  tabButton: {
    flex: 1,
    borderRadius: 18,
    marginHorizontal: 3,
    marginVertical: 2,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(0, 145, 245, 0.10)',
  },
  tabButtonPressed: {
    opacity: 0.85,
  },
  tabLabelWrap: {
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: Colors.primaryLight,
  },
} as const;
