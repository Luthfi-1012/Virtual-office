import { agents } from '@/lib/agents';

const shirts = ['#4d7165', '#c3886f', '#6b8597', '#b3955d', '#756a8d', '#638b78', '#af7464', '#436b63'];
const skins = ['#d8a377', '#e4b98e', '#bd8965', '#e0ac82', '#c89470', '#e5b88b', '#c98f66', '#d9a47b'];
const hair = ['#3a3029', '#544033', '#282a27', '#5a4130', '#2d2a28', '#46372e', '#302b27', '#49382c'];

export function AgentPortrait({ id, theme = 'light' }: { id: string; theme?: 'light' | 'dark' }) {
  const index = Math.max(0, agents.findIndex(agent => agent.id === id));
  const agent = agents[index];
  const dark = theme === 'dark';
  return <svg className="agent-portrait" viewBox="0 0 280 190" role="img" aria-label={`Ilustrasi ${agent.name} di meja kerja`}>
    <rect width="280" height="190" rx="14" fill={dark ? '#161b24' : '#eef2f6'}/>
    <path d="M0 139 140 64l140 75v51H0Z" fill={dark ? '#1d2430' : '#e2e8f0'}/>
    <path d="m0 139 140 75 140-75v51H0Z" fill={dark ? '#252e3d' : '#d5dee8'} opacity=".6"/>
    <rect x="24" y="29" width="64" height="52" rx="6" fill={dark ? '#2d3748' : '#ffffff'}/>
    <rect x="31" y="36" width="50" height="38" rx="3" fill={dark ? '#1a2d42' : '#cde3df'}/>
    <path d="M56 36v38M31 55h50" stroke={dark ? '#2d3748' : '#ffffff'} strokeWidth="3"/>
    <path d="M228 123v-43" stroke="#7b664c" strokeWidth="3"/>
    <path d="M228 95c-24-3-25-22-9-21 12 2 13 13 9 21Zm1-9c3-22 21-25 23-11 1 12-10 16-23 11Zm-2 22c-20-2-24-15-12-19 11-2 16 8 12 19Z" fill="#527b69"/>
    <path d="m215 118 4 29h20l4-29Z" fill="#b78e65"/>
    <ellipse cx="140" cy="157" rx="80" ry="15" fill={dark ? '#000000' : '#94a3b8'} opacity={dark ? '.35' : '.2'}/>
    <path d="M104 118q4-35 36-35t37 35l8 45H96Z" fill={shirts[index]}/>
    <path d="M111 107 83 139m86-32 27 32" stroke={shirts[index]} strokeWidth="17" strokeLinecap="round"/>
    <circle cx="140" cy="67" r="34" fill={skins[index]}/>
    <path d="M107 65q-2-39 34-37 35 1 33 38l-9-17q-27 12-50 1Z" fill={hair[index]}/>
    <path d="M109 59q-4 22 4 32l5-30Zm62 0q4 22-4 32l-5-30Z" fill={hair[index]}/>
    <circle cx="126" cy="68" r="2.3" fill="#1e293b"/><circle cx="154" cy="68" r="2.3" fill="#1e293b"/>
    <path d="M134 82q6 5 12 0" fill="none" stroke="#8b5e49" strokeWidth="2" strokeLinecap="round"/>
    <path d="M140 84v12" stroke={skins[index]} strokeWidth="13"/>
    <path d="m77 137 126 0 19 17H58Z" fill={dark ? '#8c6b48' : '#d2ae7f'}/>
    <path d="M58 154h164v10H58Z" fill={dark ? '#6e5235' : '#ac835a'}/>
    <path d="m117 116 54 0 8 27h-70Z" fill="#0f172a"/>
    <path d="m122 120 44 0 5 18h-54Z" fill={dark ? '#2dd4bf' : '#0f766e'}/>
    <circle cx="82" cy="142" r="8" fill={skins[index]}/><circle cx="198" cy="142" r="8" fill={skins[index]}/>
  </svg>;
}
