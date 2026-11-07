# Multipass VM scripts

See the [VM setup guide](../../docs/guides/vm-setup.md). Run from the repo root.

| File | What it is |
| --- | --- |
| `multipass.sh` | Launch, shell, stop and delete VMs (`./start vm …`) |
| `vm.config.yml` | Defaults read by `multipass.sh`: name, resources, image, Tailscale, Node.js, checkout |
| `setup-vm-tools.sh` | Install Multipass and `yq` on the host |
| `create-base-image.sh` | Build a reusable base VM |
| `test-vm-e2e.sh`, `generate-test-manifest.sh` | Full end-to-end run inside a fresh VM, and its JSON manifest |

Secrets such as `TAILSCALE_AUTH_KEY` go in the gitignored root `.env`
(see `.env.example`), never in `vm.config.yml`.
