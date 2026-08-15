/** The admin panel's own identity collection — see firestore.rules `admins/{adminId}`. */
export interface AdminDoc {
  id: string;
  uid: string;
  email: string;
  name: string;
  active: boolean;
  grantedAt: string;
  grantedBy: string;
}
