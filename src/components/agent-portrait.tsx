import { agents } from '@/lib/agents';

const shirts = ['#537468', '#c68c72', '#748b9b', '#b69a62', '#7c6e91', '#6c927e', '#b27968', '#486f68'];
const skins = ['#d8a377', '#e4b98e', '#bd8965', '#e0ac82', '#c89470', '#e5b88b', '#c98f66', '#d9a47b'];
const hair = ['#3a3029', '#544033', '#282a27', '#5a4130', '#2d2a28', '#46372e', '#302b27', '#49382c'];
export function AgentPortrait({ id }: { id: string }) {
  const index = Math.max(0, agents.findIndex(agent => agent.id === id));
  const agent = agents[index];
  return <svg className="agent-portrait" viewBox="0 0 280 190" role="img" aria-label={`Ilustrasi ${agent.name} di meja kerja`}>
    <rect width="280" height="190" rx="18" fill="#dfe6d9"/>
    <path d="M0 139 140 64l140 75v51H0Z" fill="#c8d2c1"/>
    <path d="m0 139 140 75 140-75v51H0Z" fill="#b9c6b3" opacity=".55"/>
    <rect x="24" y="29" width="64" height="52" rx="5" fill="#f3f0e5"/>
    <rect x="31" y="36" width="50" height="38" rx="2" fill="#b6d0c5"/>
    <path d="M56 36v38M31 55h50" stroke="#f3f0e5" strokeWidth="3"/>
    <path d="M228 123v-43" stroke="#7b664c" strokeWidth="3"/>
    <path d="M228 95c-24-3-25-22-9-21 12 2 13 13 9 21Zm1-9c3-22 21-25 23-11 1 12-10 16-23 11Zm-2 22c-20-2-24-15-12-19 11-2 16 8 12 19Z" fill="#648467"/>
    <path d="m215 118 4 29h20l4-29Z" fill="#b78e65"/>
    <ellipse cx="140" cy="157" rx="80" ry="15" fill="#7f927f" opacity=".22"/>
    <path d="M104 118q4-35 36-35t37 35l8 45H96Z" fill={shirts[index]}/>
    <path d="M111 107 83 139m86-32 27 32" stroke={shirts[index]} strokeWidth="17" strokeLinecap="round"/>
    <circle cx="140" cy="67" r="34" fill={skins[index]}/>
    <path d="M107 65q-2-39 34-37 35 1 33 38l-9-17q-27 12-50 1Z" fill={hair[index]}/>
    <path d="M109 59q-4 22 4 32l5-30Zm62 0q4 22-4 32l-5-30Z" fill={hair[index]}/>
    <circle cx="126" cy="68" r="2.3" fill="#354440"/><circle cx="154" cy="68" r="2.3" fill="#354440"/>
    <path d="M134 82q6 5 12 0" fill="none" stroke="#8b5e49" strokeWidth="2" strokeLinecap="round"/>
    <path d="M140 84v12" stroke={skins[index]} strokeWidth="13"/>
    <path d="m77 137 126 0 19 17H58Z" fill="#d2ae7f"/>
    <path d="M58 154h164v10H58Z" fill="#ac835a"/>
    <path d="m117 116 54 0 8 27h-70Z" fill="#354440"/>
    <path d="m122 120 44 0 5 18h-54Z" fill="#416d5c"/>
    <circle cx="82" cy="142" r="8" fill={skins[index]}/><circle cx="198" cy="142" r="8" fill={skins[index]}/>
  </svg>;
}
