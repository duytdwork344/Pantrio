class UserProfile {
  UserProfile({
    required this.id,
    required this.email,
    required this.displayName,
    this.locale,
    required this.roles,
    required this.permissions,
  });

  final String id;
  final String email;
  final String displayName;

  /// Preferred locale (User.locale); null = follow the device.
  final String? locale;
  final List<String> roles;
  final List<String> permissions;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      displayName: json['displayName'] as String,
      locale: json['locale'] as String?,
      roles: (json['roles'] as List<dynamic>? ?? const [])
          .map((e) => e as String)
          .toList(),
      permissions: (json['permissions'] as List<dynamic>? ?? const [])
          .map((e) => e as String)
          .toList(),
    );
  }
}
