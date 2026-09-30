# 16 — Behavioral parity matrix

| Functionality | Firebase | Supabase target | Parity | Tested on Supabase? |
|---|---|---|---|---|
| Cadastro | implemented | Auth + provisioning trigger | PARTIAL | NO |
| Login | implemented | Supabase Auth | PARTIAL | NO |
| Google Login | implemented | Google OAuth | PARTIAL | NO |
| Recuperação de senha | implemented | Supabase Auth reset | PARTIAL | NO |
| Criar perfil | implemented | Auth trigger/profile | PARTIAL | NO |
| Alterar username | 7-day cooldown, no global unique | unique + 7-day RPC | PARTIAL | SQL + parallel race |
| Criar canal | implemented | channels + RLS | PARTIAL | NO |
| Criar live | implemented | `create_live` RPC | PARTIAL | NO |
| Editar/live state | implemented | state RPC | PARTIAL | NO |
| Entrar na live | implemented | viewer heartbeat + Presence | PARTIAL | NO |
| Chat | implemented | message RPC + Postgres Changes | PARTIAL | NO |
| Slow mode | Rules + rate doc | private atomic rate row | PARTIAL | NO |
| Ban/mute | implemented | live bans RPC | PARTIAL | NO |
| Moderador | implemented | explicit relation | PARTIAL | NO |
| Poll | implemented | normalized poll tables | PARTIAL | NO |
| Voto duplicado | denied | PK + RPC | PARTIAL | NO |
| Reaction | implemented | rate RPC + short retention/Broadcast path | PARTIAL | NO |
| Follow | duplicated docs | canonical unique relation | PARTIAL | NO |
| Schedule | implemented | `live_schedules` | PARTIAL | NO |
| Reward | implemented | `rewards` | PARTIAL | NO |
| Reward redemption | implemented | atomic ledger/redemption RPC | PARTIAL | NO |
| Zy Coins | implemented in client-coordinated transactions | server-owned ledger RPCs | PARTIAL | SQL + parallel overspend/idempotency |
| Clip metadata | implemented | `clips` | PARTIAL | NO |
| Clip media pipeline | not implemented | not invented | N/A | N/A |
| Report | implemented | private report RPC/RLS | PARTIAL | NO |
| Moderação | implemented | penalties/actions/audit | PARTIAL | NO |
| Aceite de políticas | implemented | immutable versioned rows | PARTIAL | NO |
| Storage uploads | not found | scoped image buckets | PARTIAL | NO |
| Cloud Functions | not found | no forced replacement | N/A | N/A |

The schema is applied to isolated staging, but behavioral parity remains incomplete until real Auth/Data API/browser flows and real-data reconciliation pass.
