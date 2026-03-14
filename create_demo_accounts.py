#!/usr/bin/env python3
"""Create demo accounts in Firebase Auth for publishing books from different users."""

import firebase_admin
from firebase_admin import auth

firebase_admin.initialize_app(options={"projectId": "storyforge-hackathon-1beac"})

ACCOUNTS = [
    {
        "email": "aria.moonweaver@reveria.app",
        "password": "Rev3ria!Aria2026",
        "display_name": "Aria Moonweaver",
    },
    {
        "email": "kai.stormlight@reveria.app",
        "password": "Rev3ria!Kai2026",
        "display_name": "Kai Stormlight",
    },
    {
        "email": "luna.inkwell@reveria.app",
        "password": "Rev3ria!Luna2026",
        "display_name": "Luna Inkwell",
    },
    {
        "email": "felix.pagecraft@reveria.app",
        "password": "Rev3ria!Felix2026",
        "display_name": "Felix Pagecraft",
    },
    {
        "email": "mira.fablerose@reveria.app",
        "password": "Rev3ria!Mira2026",
        "display_name": "Mira Fablerose",
    },
    {
        "email": "sage.mythkeeper@reveria.app",
        "password": "Rev3ria!Sage2026",
        "display_name": "Sage Mythkeeper",
    },
]


def main():
    created = []
    for acct in ACCOUNTS:
        try:
            user = auth.create_user(
                email=acct["email"],
                password=acct["password"],
                display_name=acct["display_name"],
                email_verified=True,
            )
            print(f"  Created: {acct['display_name']} ({user.uid})")
            created.append({**acct, "uid": user.uid})
        except auth.EmailAlreadyExistsError:
            user = auth.get_user_by_email(acct["email"])
            print(f"  Exists:  {acct['display_name']} ({user.uid})")
            created.append({**acct, "uid": user.uid})
        except Exception as e:
            print(f"  Error:   {acct['display_name']} — {e}")

    # Write .env.demo-accounts
    env_path = "demo_accounts.env"
    with open(env_path, "w") as f:
        f.write("# Demo accounts for publishing books from different users\n")
        f.write("# Created by create_demo_accounts.py\n\n")
        for i, acct in enumerate(created, 1):
            prefix = f"DEMO_USER_{i}"
            f.write(f"{prefix}_EMAIL={acct['email']}\n")
            f.write(f"{prefix}_PASSWORD={acct['password']}\n")
            f.write(f"{prefix}_NAME={acct['display_name']}\n")
            f.write(f"{prefix}_UID={acct['uid']}\n\n")

    print(f"\nCredentials saved to {env_path}")


if __name__ == "__main__":
    main()
