export type AvatarPreset = {
  id: string;
  name: string;
  category: "zodiac" | "food";
  src: string;
};

// Keep v1 URLs immutable: replacement artwork belongs in a new version folder.
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "rat", name: "团团鼠", category: "zodiac", src: "/avatars/v1/rat.webp" },
  { id: "ox", name: "憨憨牛", category: "zodiac", src: "/avatars/v1/ox.webp" },
  { id: "tiger", name: "小橘虎", category: "zodiac", src: "/avatars/v1/tiger.webp" },
  { id: "rabbit", name: "糯糯兔", category: "zodiac", src: "/avatars/v1/rabbit.webp" },
  { id: "dragon", name: "团子龙", category: "zodiac", src: "/avatars/v1/dragon.webp" },
  { id: "snake", name: "弯弯蛇", category: "zodiac", src: "/avatars/v1/snake.webp" },
  { id: "horse", name: "栗栗马", category: "zodiac", src: "/avatars/v1/horse.webp" },
  { id: "goat", name: "绵绵羊", category: "zodiac", src: "/avatars/v1/goat.webp" },
  { id: "monkey", name: "桃桃猴", category: "zodiac", src: "/avatars/v1/monkey.webp" },
  { id: "rooster", name: "啾啾鸡", category: "zodiac", src: "/avatars/v1/rooster.webp" },
  { id: "dog", name: "旺旺狗", category: "zodiac", src: "/avatars/v1/dog.webp" },
  { id: "pig", name: "呼噜猪", category: "zodiac", src: "/avatars/v1/pig.webp" },
  { id: "bao", name: "软软包", category: "food", src: "/avatars/v1/bao.webp" },
  { id: "dumpling", name: "弯弯饺", category: "food", src: "/avatars/v1/dumpling.webp" },
  { id: "zongzi", name: "青青粽", category: "food", src: "/avatars/v1/zongzi.webp" },
  { id: "tangyuan", name: "圆圆汤", category: "food", src: "/avatars/v1/tangyuan.webp" },
  { id: "youtiao", name: "金金条", category: "food", src: "/avatars/v1/youtiao.webp" },
  { id: "mooncake", name: "甜甜饼", category: "food", src: "/avatars/v1/mooncake.webp" },
];

export function getAvatarPreset(id: unknown) {
  return AVATAR_PRESETS.find(avatar => avatar.id === id);
}
