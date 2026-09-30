import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:provider/provider.dart';

/// Personal (0) | Group (1) segmented control used by Inventory & Shopping.
class ScopeSegmentBar extends StatelessWidget {
  const ScopeSegmentBar({
    super.key,
    required this.index,
    required this.onChanged,
  });

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: SegmentedButton<int>(
        segments: const [
          ButtonSegment(value: 0, label: Text('Personal'), icon: Icon(Icons.person_outline)),
          ButtonSegment(value: 1, label: Text('Group'), icon: Icon(Icons.groups_outlined)),
        ],
        selected: {index},
        onSelectionChanged: (s) => onChanged(s.first),
      ),
    );
  }
}

/// Empty / join-or-create gate when user has no InventoryGroup.
class GroupJoinPane extends StatelessWidget {
  const GroupJoinPane({
    super.key,
    required this.onJoined,
    this.message =
        'Create a household group or join with an invite code to share inventory and shopping lists.',
  });

  final Future<void> Function() onJoined;
  final String message;

  Future<void> _create(BuildContext context) async {
    final session = context.read<AuthSession>();
    final api = session.api;
    final messenger = ScaffoldMessenger.of(context);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => const _CreateGroupDialog(),
    );
    if (name == null || name.isEmpty) return;
    try {
      await api.createGroup(name: name);
      await session.reloadMembership();
      messenger.showSnackBar(
        const SnackBar(content: Text('Group created')),
      );
      await onJoined();
    } on ApiException catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _join(BuildContext context) async {
    final session = context.read<AuthSession>();
    final api = session.api;
    final messenger = ScaffoldMessenger.of(context);
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) => const _JoinGroupDialog(),
    );
    if (code == null || code.isEmpty) return;
    try {
      await api.joinGroup(code: code);
      await session.reloadMembership();
      messenger.showSnackBar(
        const SnackBar(content: Text('Joined group')),
      );
      await onJoined();
    } on ApiException catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 48),
        Icon(
          Icons.groups_outlined,
          size: 48,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          'No shared group yet',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () => _create(context),
          icon: const Icon(Icons.add),
          label: const Text('Create group'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _join(context),
          icon: const Icon(Icons.login),
          label: const Text('Join with invite code'),
        ),
      ],
    );
  }
}

class GroupHeaderBar extends StatelessWidget {
  const GroupHeaderBar({
    super.key,
    required this.group,
    required this.onChanged,
  });

  final InventoryGroup group;
  final Future<void> Function() onChanged;

  Future<void> _copyCode(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: group.inviteCode));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Invite code copied: ${group.inviteCode}')),
    );
  }

  Future<void> _rotate(BuildContext context) async {
    final session = context.read<AuthSession>();
    try {
      await session.api.rotateGroupInvite();
      await session.reloadMembership();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invite code rotated')),
      );
      await onChanged();
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _leave(BuildContext context) async {
    final session = context.read<AuthSession>();
    final api = session.api;
    final messenger = ScaffoldMessenger.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(group.isOwner ? 'Leave & dissolve group?' : 'Leave group?'),
        content: Text(
          group.isOwner
              ? 'You are the only owner. Leaving dissolves the group and deletes shared pantry & lists.'
              : 'You will lose access to the shared pantry and shopping lists.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final result = await api.leaveGroup();
      await session.reloadMembership();
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            result.dissolved == true ? 'Group dissolved' : 'Left group',
          ),
        ),
      );
      await onChanged();
    } on ApiException catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.name,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${group.members.length} member${group.members.length == 1 ? '' : 's'}'
                    ' · invite ${group.inviteCode}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Copy invite',
              onPressed: () => _copyCode(context),
              icon: const Icon(Icons.copy_outlined),
            ),
            if (group.isOwner)
              IconButton(
                tooltip: 'Rotate invite',
                onPressed: () => _rotate(context),
                icon: const Icon(Icons.refresh),
              ),
            IconButton(
              tooltip: 'Leave group',
              onPressed: () => _leave(context),
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateGroupDialog extends StatefulWidget {
  const _CreateGroupDialog();

  @override
  State<_CreateGroupDialog> createState() => _CreateGroupDialogState();
}

class _CreateGroupDialogState extends State<_CreateGroupDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: 'Nhà mình');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Create group'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: const InputDecoration(
          labelText: 'Group name',
          border: OutlineInputBorder(),
        ),
        onSubmitted: (v) => Navigator.pop(context, v.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('Create'),
        ),
      ],
    );
  }
}

class _JoinGroupDialog extends StatefulWidget {
  const _JoinGroupDialog();

  @override
  State<_JoinGroupDialog> createState() => _JoinGroupDialogState();
}

class _JoinGroupDialogState extends State<_JoinGroupDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Join group'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(
          labelText: 'Invite code',
          border: OutlineInputBorder(),
        ),
        onSubmitted: (v) => Navigator.pop(context, v.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('Join'),
        ),
      ],
    );
  }
}
