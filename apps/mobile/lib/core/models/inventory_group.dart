class InventoryGroupMember {
  InventoryGroupMember({
    required this.userId,
    required this.displayName,
    required this.role,
    required this.joinedAt,
  });

  final String userId;
  final String displayName;
  final String role;
  final String joinedAt;

  factory InventoryGroupMember.fromJson(Map<String, dynamic> json) {
    return InventoryGroupMember(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      role: json['role'] as String,
      joinedAt: json['joinedAt'] as String,
    );
  }
}

class InventoryGroup {
  InventoryGroup({
    required this.id,
    required this.name,
    required this.inviteCode,
    required this.inviteUseCount,
    required this.myRole,
    required this.members,
    this.inviteExpiresAt,
    this.inviteMaxUses,
  });

  final String id;
  final String name;
  final String inviteCode;
  final int inviteUseCount;
  final String myRole;
  final List<InventoryGroupMember> members;
  final String? inviteExpiresAt;
  final int? inviteMaxUses;

  bool get isOwner => myRole == 'OWNER';

  factory InventoryGroup.fromJson(Map<String, dynamic> json) {
    return InventoryGroup(
      id: json['id'] as String,
      name: json['name'] as String,
      inviteCode: json['inviteCode'] as String,
      inviteUseCount: json['inviteUseCount'] as int? ?? 0,
      myRole: json['myRole'] as String,
      inviteExpiresAt: json['inviteExpiresAt'] as String?,
      inviteMaxUses: json['inviteMaxUses'] as int?,
      members: (json['members'] as List<dynamic>? ?? const [])
          .map(
            (e) => InventoryGroupMember.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
