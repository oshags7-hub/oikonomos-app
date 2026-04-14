import React, { createContext, useContext, useState } from 'react';
import { type Profile, type ThemeColors, getTheme } from '@/constants/Colors';

type ProfileContextValue = {
  profile: Profile;
  setProfile: (p: Profile) => void;
  theme: ThemeColors;
};

const ProfileContext = createContext<ProfileContextValue>({
  profile: 'mom',
  setProfile: () => {},
  theme: getTheme('mom'),
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>('mom');
  const theme = getTheme(profile);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, theme }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
