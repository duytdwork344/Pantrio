# Prisma MVP domain notes
#
# - Food = system ingredient master (not user-owned)
# - InventoryItem = one batch/package (FEFO via expiryDate ordering)
# - InventoryTransaction = audit trail; quantity fields on InventoryItem are cache
# - Recipe quantity is recommendation, not consumption ground truth
# - Article is separate from Recipe
# - RBAC: UserRole + RolePermission (Role != Permission)
