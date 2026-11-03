## url-install

exit: 0

stdout:

```
Cloning plugin from https://github.com/epistemedeus/x402-data-gateway-skills.git...
Found bulk plugins directory: /tmp/h130010-evidence/tmp-url/plugin-install-848664510/plugins

Installing plugin "public-careers-board"...
  [ok]    public-careers-board
          ✔ skills      : 1 installed (public-careers-board)
          Installed to /tmp/h130010-evidence/home-url/.gemini/config/plugins/public-careers-board

Installing plugin "samedaydesk-antigravity"...
  [ok]    samedaydesk
          ✔ skills      : 1 installed (samedaydesk-remote-mcp)
          ✔ mcpServers  : 1 installed (samedaydesk)
          Installed to /tmp/h130010-evidence/home-url/.gemini/config/plugins/samedaydesk

----------------------------------------
Successfully installed 2 plugins: public-careers-board, samedaydesk-antigravity
```

stderr:

```

```

## url-list

exit: 0

stdout:

```
[
  {
    "name": "public-careers-board",
    "enabled": true,
    "version": "0.1.3",
    "source": "claude-code",
    "path": "/tmp/h130010-evidence/home-url/.gemini/config/plugins/public-careers-board",
    "skills": [
      "public-careers-board"
    ]
  },
  {
    "name": "samedaydesk",
    "enabled": true,
    "version": "0.1.3",
    "source": "antigravity",
    "path": "/tmp/h130010-evidence/home-url/.gemini/config/plugins/samedaydesk",
    "skills": [
      "samedaydesk-remote-mcp"
    ],
    "mcpServers": [
      "samedaydesk"
    ]
  }
]
```

stderr:

```

```

## exact-rev

exit: 0

stdout:

```
10fe00777a8ff99551bc0cd80df528fb3b8608cc
```

stderr:

```

```

## exact-remote-v

exit: 0

stdout:

```
origin	https://github.com/epistemedeus/x402-data-gateway-skills.git (fetch)
origin	https://github.com/epistemedeus/x402-data-gateway-skills.git (push)
```

stderr:

```

```

## exact-config

exit: 0

stdout:

```
file:/tmp/h130010-evidence/home-git/gitconfig	credential.helper=
file:.git/config	core.repositoryformatversion=0
file:.git/config	core.filemode=true
file:.git/config	core.bare=false
file:.git/config	core.logallrefupdates=true
file:.git/config	remote.origin.url=https://github.com/epistemedeus/x402-data-gateway-skills.git
file:.git/config	remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*
command line:	credential.helper=
```

stderr:

```

```

## exact-install

exit: 0

stdout:

```
  [ok]    public-careers-board
          ✔ skills      : 1 installed (public-careers-board)
          Installed to /tmp/h130010-evidence/home-exact/.gemini/config/plugins/public-careers-board
```

stderr:

```

```

## exact-list

exit: 0

stdout:

```
[
  {
    "name": "public-careers-board",
    "enabled": true,
    "version": "0.1.3",
    "source": "claude-code",
    "path": "/tmp/h130010-evidence/home-exact/.gemini/config/plugins/public-careers-board",
    "skills": [
      "public-careers-board"
    ]
  }
]
```

stderr:

```

```

## simple-clone

exit: 0

stdout:

```

```

stderr:

```
Cloning into '/tmp/h130010-evidence/simple'...
```

## simple-checkout

exit: 0

stdout:

```

```

stderr:

```
Note: switching to '10fe00777a8ff99551bc0cd80df528fb3b8608cc'.

You are in 'detached HEAD' state. You can look around, make experimental
changes and commit them, and you can discard any commits you make in this
state without impacting any branches by switching back to a branch.

If you want to create a new branch to retain commits you create, you may
do so (now or later) by using -c with the switch command. Example:

  git switch -c <new-branch-name>

Or undo this operation with:

  git switch -

Turn off this advice by setting config variable advice.detachedHead to false

HEAD is now at 10fe007 Merge pull request #24 from epistemedeus/codex/h98310-board-notice-journey-20261101
```

## simple-rev

exit: 0

stdout:

```
10fe00777a8ff99551bc0cd80df528fb3b8608cc
```

stderr:

```

```

## simple-install

exit: 0

stdout:

```
  [ok]    public-careers-board
          ✔ skills      : 1 installed (public-careers-board)
          Installed to /tmp/h130010-evidence/home-simple/.gemini/config/plugins/public-careers-board
```

stderr:

```

```

## simple-list

exit: 0

stdout:

```
[
  {
    "name": "public-careers-board",
    "enabled": true,
    "version": "0.1.3",
    "source": "claude-code",
    "path": "/tmp/h130010-evidence/home-simple/.gemini/config/plugins/public-careers-board",
    "skills": [
      "public-careers-board"
    ]
  }
]
```

stderr:

```

```

## ctrl-missing

exit: 0

stdout:

```
{"schema":"public-careers-board.result.v1","paymentSent":false,"paidFallback":false,"charged":false,"useful":null,"seeded":false,"sourceCoverage":null,"runtime":"22.23.4","result":"missing_input","reason":"missing_input","board":null,"reader":null,"source":null,"rows":null,"coverage":null,"nextAction":"Pass --board with one supported id: acxiom, acxiomllc, liveramp, liveramp-inc, liverampashby, liveramp-ashby, magnite, or magnite-careers.","elapsedMs":4}
```

stderr:

```

```

## ctrl-unknown

exit: 0

stdout:

```
{"schema":"public-careers-board.result.v1","paymentSent":false,"paidFallback":false,"charged":false,"useful":null,"seeded":false,"sourceCoverage":null,"runtime":"22.23.4","result":"unknown_board","reason":"unknown_board","board":"notion","reader":null,"source":null,"rows":null,"coverage":null,"nextAction":"That board is not supported. No source was read.","elapsedMs":4}
```

stderr:

```

```

## ctrl-wrong-source

exit: 0

stdout:

```
{"schema":"public-careers-board.result.v1","paymentSent":false,"paidFallback":false,"charged":false,"useful":null,"seeded":false,"sourceCoverage":null,"runtime":"22.23.4","result":"wrong_source","reason":"wrong_source","board":"liveramp","reader":"fetchAshby","source":null,"rows":null,"coverage":null,"emptyBoard":false,"complete":false,"nextAction":"That source is not the supported reader. Acxiom uses Workday. LiveRamp uses Ashby. No other origin is fetched.","elapsedMs":5}
```

stderr:

```

```

## ctrl-no-node

exit: 127

stdout:

```

```

stderr:

```
env: ‘node’: No such file or directory
```

## ctrl-runtime-predicate

exit: 0

stdout:

```
22.22.1 false
v22.22.1 false
20.17.0 false
22.22.2 true
22.23.4 true
v24.22.2 true
 false
```

stderr:

```

```

## refuse-root

exit: 0

stdout:

```
Found bulk plugins directory: /tmp/h130010-evidence/src/plugins

Installing plugin "public-careers-board"...
  [ok]    public-careers-board
          ✔ skills      : 1 installed (public-careers-board)
          Installed to /tmp/h130010-evidence/home-refuse/.gemini/config/plugins/public-careers-board

Installing plugin "samedaydesk-antigravity"...
  [ok]    samedaydesk
          ✔ skills      : 1 installed (samedaydesk-remote-mcp)
          ✔ mcpServers  : 1 installed (samedaydesk)
          Installed to /tmp/h130010-evidence/home-refuse/.gemini/config/plugins/samedaydesk

----------------------------------------
Successfully installed 2 plugins: public-careers-board, samedaydesk-antigravity
```

stderr:

```

```

## refuse-empty

exit: 1

stdout:

```

```

stderr:

```
Error: could not detect plugin structure at /tmp/h130010-evidence/empty-plugin
```

## refuse-missing-dir

exit: 1

stdout:

```

```

stderr:

```
Error: install target must be a directory: /tmp/h130010-evidence/does-not-exist
```

## refuse-file

exit: 1

stdout:

```

```

stderr:

```
Error: install target must be a directory: /tmp/h130010-evidence/src/plugins/public-careers-board/README.md
```

## refuse-bad-url

exit: 1

stdout:

```
Cloning plugin from https://github.com/epistemedeus/x402-data-gateway-skills-not-a-source.git...
```

stderr:

```
Error: failed to clone plugin: git clone failed: exit status 128, output: Cloning into '/tmp/h130010-evidence/tmp-refuse/plugin-install-1310264267'...
error: unable to read askpass response from '/bin/false'
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

## refuse-list

exit: 0

stdout:

```
[
  {
    "name": "public-careers-board",
    "enabled": true,
    "version": "0.1.3",
    "source": "claude-code",
    "path": "/tmp/h130010-evidence/home-refuse/.gemini/config/plugins/public-careers-board",
    "skills": [
      "public-careers-board"
    ]
  },
  {
    "name": "samedaydesk",
    "enabled": true,
    "version": "0.1.3",
    "source": "antigravity",
    "path": "/tmp/h130010-evidence/home-refuse/.gemini/config/plugins/samedaydesk",
    "skills": [
      "samedaydesk-remote-mcp"
    ],
    "mcpServers": [
      "samedaydesk"
    ]
  }
]
```

stderr:

```

```

## doc-install

exit: 0

stdout:

```
  [ok]    public-careers-board
          ✔ skills      : 1 installed (public-careers-board)
          Installed to /tmp/h130010-evidence/home-doc/.gemini/config/plugins/public-careers-board
```

stderr:

```

```

## doc-list

exit: 0

stdout:

```
[
  {
    "name": "public-careers-board",
    "enabled": true,
    "version": "0.1.3",
    "source": "claude-code",
    "path": "/tmp/h130010-evidence/home-doc/.gemini/config/plugins/public-careers-board",
    "skills": [
      "public-careers-board"
    ]
  }
]
```

stderr:

```

```

## exact-fetch

exit: 0

stdout:

```

```

stderr:

```
From https://github.com/epistemedeus/x402-data-gateway-skills
 * branch            10fe00777a8ff99551bc0cd80df528fb3b8608cc -> FETCH_HEAD
```
