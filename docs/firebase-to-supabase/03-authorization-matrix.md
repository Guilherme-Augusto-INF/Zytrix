# 03 — Authorization matrix

Legend: `R` read, `C` create, `U` update, `D` delete, `RPC` controlled operation, `—` denied. Public reads apply only to non-deleted/public rows where relevant.

| Resource | Visitor | Authenticated | Owner/self | Live moderator | Admin | Service backend |
|---|---:|---:|---:|---:|---:|---:|
| Public profile | R | R | R, RPC update | R | R, admin operation | CRUD |
| Private account | — | — | R | — | R | CRUD |
| Admin membership | — | — | self R | — | R | CRUD |
| Channel | public R | public R | C, R, safe U | R | R, admin operation | CRUD |
| Channel private data | — | — | R/W through backend | — | R/W | CRUD |
| Live | public R | public R | C/RPC state/U | R | all via admin operation | CRUD |
| Follow | — | participant R | C/D own | — | R/D | CRUD |
| Channel member | — | self R | channel-owner C/D | — | R/C/D | CRUD |
| Live moderator | — | self R | live-owner C/D | self R | R/C/D | CRUD |
| Schedule/reward | R | R | channel-owner C/U/D | R | C/U/D | CRUD |
| Chat settings | R | R | live-owner C/U/D | C/U/D | C/U/D | CRUD |
| Chat message | visible R | visible R | RPC C; own RPC D | RPC D | RPC D | CRUD |
| Live ban/mute | — | subject R | live-owner RPC | RPC | RPC | CRUD |
| Reaction | current R | current R; RPC C | same | same | same | CRUD |
| Poll/options | R | R | live-owner/mod RPC | RPC | RPC | CRUD |
| Poll vote | — | own R; RPC C | own R | list R | list R | CRUD |
| Viewer session | — | own RPC heartbeat | same | aggregate only | aggregate/list | CRUD |
| Wallet | — | — | R | — | R | CRUD/RPC |
| Coin ledger | — | participant R | participant R | — | R | append/reverse |
| Coin order | — | own R | own R | — | R/admin transition | CRUD/webhook |
| Promotion | active R | active R; RPC claim | same | same | admin operation | CRUD |
| Reward redemption | — | participant R; RPC create | same | channel-owner fulfill | all | CRUD |
| Clip | public R | public R; RPC C | RPC D | — | RPC D | CRUD |
| Global penalty | — | subject R | subject R | — | admin operation | CRUD |
| Moderation action/audit | — | — | — | — | R/admin operation | append |
| Report | — | own R; RPC C | own R | — | R/RPC close | CRUD |
| Policy acceptance | — | own R/C | own R/C | — | R | CRUD |
| Governance config | R | R | R | R | R | CRUD |
| Audit log | — | — | — | — | R | append |
| Avatar object | R | R | owner C/U/D | — | backend operation | CRUD |
| Channel/live asset | R | R | related owner C/U/D | — | backend operation | CRUD |

## Trusted authority sources

- Admin: `public.admins`, writable only by a privileged backend/admin process.
- Channel owner: immutable `channels.owner_id` FK.
- Live owner: immutable `lives.owner_id` FK.
- Moderator: `live_moderators` relationship provisioned by owner/admin.
- Self: `auth.uid()` equality.
- Service backend: Supabase secret/service role, never shipped to the browser.

