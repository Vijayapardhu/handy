/// How a Hub percentage is graded.
///
/// A port of src/lib/calculations/hubAttendance.ts. The Hub has no
/// college-configured target the way official attendance does — those
/// thresholds come from `colleges/{id}` — so this is a plain, ungraded read
/// against a fixed band.
///
/// The one thing that matters is that every surface colouring a Hub
/// percentage uses this exact band, or the same number shows as one status in
/// one place and another somewhere else.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

enum HubStatus { critical, low, average, good, excellent, na }

/// Matches HUB_STATUS_THRESHOLDS on the web, lower bounds inclusive.
HubStatus hubStatus(double? percentage) {
  if (percentage == null) return HubStatus.na;
  if (percentage >= 90) return HubStatus.excellent;
  if (percentage >= 75) return HubStatus.good;
  if (percentage >= 65) return HubStatus.average;
  if (percentage >= 50) return HubStatus.low;
  return HubStatus.critical;
}

extension HubStatusLook on HubStatus {
  String get label => switch (this) {
        HubStatus.excellent => 'Excellent',
        HubStatus.good => 'Good',
        HubStatus.average => 'Average',
        HubStatus.low => 'Low',
        HubStatus.critical => 'Critical',
        HubStatus.na => 'No data',
      };

  Color get colour => switch (this) {
        HubStatus.excellent || HubStatus.good => HandyColors.good,
        HubStatus.average => HandyColors.warn,
        HubStatus.low || HubStatus.critical => HandyColors.bad,
        HubStatus.na => HandyColors.lightMuted,
      };
}
