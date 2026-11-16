import type { DomainRecord } from './store';

export const sampleData: DomainRecord[] = [
  {
    "status": "active",
    "state_history": [
      {
        "title": "Trial started",
        "from": "future",
        "to": "trialing",
        "at": "2026-02-16T15:00:00Z",
        "reason": "Started a 14-day Team trial"
      },
      {
        "title": "Trial converted",
        "from": "trialing",
        "to": "active",
        "at": "2026-03-02T15:00:00Z",
        "reason": "First Team payment collected"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": false,
    "cancellation_reason_code": "",
    "created_at": "2026-02-16T15:00:00Z",
    "updated_at": "2026-09-02T15:00:00Z",
    "last_event": "payment_received",
    "last_event_at": "2026-09-02T15:00:00Z",
    "amount": 14900,
    "currency": "USD",
    "billing_interval": "monthly",
    "payment_status": "succeeded",
    "payment_method_type": "card",
    "proration_amount": 5333,
    "proration_date": 0,
    "last_payment_at": "2026-09-02T15:00:00Z",
    "next_payment_due_at": "2026-10-02T15:00:00Z",
    "current_period_start": "2026-09-02T15:00:00Z",
    "current_period_end": "2026-10-02T15:00:00Z",
    "current_period_progress": 0.93,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_northwind_business",
    "plan_name": "Business",
    "plan_code": "business-monthly",
    "plan_interval": "monthly",
    "customer_name": "Northwind Traders",
    "customer_email": "billing@northwind.example",
    "payment_history": [
      {
        "at": "2026-03-02T15:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-04-02T15:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-05-02T15:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-06-02T15:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-06-16T15:00:00Z",
        "amount": 5333
      },
      {
        "at": "2026-07-02T15:00:00Z",
        "amount": 14900
      },
      {
        "at": "2026-08-02T15:00:00Z",
        "amount": 14900
      },
      {
        "at": "2026-09-02T15:00:00Z",
        "amount": 14900
      }
    ]
  },
  {
    "status": "paused",
    "state_history": [
      {
        "title": "Started",
        "from": "future",
        "to": "active",
        "at": "2026-04-10T15:00:00Z",
        "reason": "Analytics add-on purchased"
      },
      {
        "title": "Paused",
        "from": "active",
        "to": "paused",
        "at": "2026-08-20T14:00:00Z",
        "reason": "Paused during the ERP migration"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": false,
    "cancellation_reason_code": "",
    "created_at": "2026-04-10T15:00:00Z",
    "updated_at": "2026-09-10T15:00:00Z",
    "last_event": "billing_cycle_completed",
    "last_event_at": "2026-09-10T15:00:00Z",
    "amount": 3900,
    "currency": "USD",
    "billing_interval": "monthly",
    "payment_status": "succeeded",
    "payment_method_type": "card",
    "proration_amount": 0,
    "proration_date": 0,
    "last_payment_at": "2026-08-10T15:00:00Z",
    "current_period_start": "2026-08-10T15:00:00Z",
    "current_period_end": "2026-09-10T15:00:00Z",
    "current_period_progress": 1,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_northwind_analytics",
    "plan_name": "Analytics add-on",
    "plan_code": "analytics-addon-monthly",
    "plan_interval": "monthly",
    "customer_name": "Northwind Traders",
    "customer_email": "billing@northwind.example",
    "payment_history": [
      {
        "at": "2026-04-10T15:00:00Z",
        "amount": 3900
      },
      {
        "at": "2026-05-10T15:00:00Z",
        "amount": 3900
      },
      {
        "at": "2026-06-10T15:00:00Z",
        "amount": 3900
      },
      {
        "at": "2026-07-10T15:00:00Z",
        "amount": 3900
      },
      {
        "at": "2026-08-10T15:00:00Z",
        "amount": 3900
      }
    ]
  },
  {
    "status": "active",
    "state_history": [
      {
        "title": "Started",
        "from": "future",
        "to": "active",
        "at": "2026-01-15T08:00:00Z",
        "reason": "Subscribed to the Starter plan"
      },
      {
        "title": "Payment failed",
        "from": "active",
        "to": "past_due",
        "at": "2026-05-15T08:00:00Z",
        "reason": "Card expired; retrying"
      },
      {
        "title": "Recovered",
        "from": "past_due",
        "to": "active",
        "at": "2026-05-17T08:00:00Z",
        "reason": "New card charged"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": false,
    "cancellation_reason_code": "",
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-09-15T08:00:00Z",
    "last_event": "payment_received",
    "last_event_at": "2026-09-15T08:00:00Z",
    "amount": 1900,
    "currency": "EUR",
    "billing_interval": "monthly",
    "payment_status": "succeeded",
    "payment_method_type": "card",
    "proration_amount": 0,
    "proration_date": 0,
    "last_payment_at": "2026-09-15T08:00:00Z",
    "next_payment_due_at": "2026-10-15T08:00:00Z",
    "current_period_start": "2026-09-15T08:00:00Z",
    "current_period_end": "2026-10-15T08:00:00Z",
    "current_period_progress": 0.5,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_lindqvist_starter",
    "plan_name": "Starter",
    "plan_code": "starter-monthly",
    "plan_interval": "monthly",
    "customer_name": "Lindqvist Bakery",
    "customer_email": "finance@lindqvist.example",
    "payment_history": [
      {
        "at": "2026-01-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-02-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-03-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-04-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-05-17T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-06-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-07-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-08-15T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-08-16T08:00:00Z",
        "amount": 1900
      },
      {
        "at": "2026-08-19T11:30:00Z",
        "amount": -1900
      },
      {
        "at": "2026-09-15T08:00:00Z",
        "amount": 1900
      }
    ]
  },
  {
    "status": "trialing",
    "state_history": [
      {
        "title": "Scheduled",
        "from": null,
        "to": "future",
        "at": "2026-09-19T10:00:00Z",
        "reason": "Trial starts once a card is verified"
      },
      {
        "title": "Trial started",
        "from": "future",
        "to": "trialing",
        "at": "2026-09-21T09:00:00Z",
        "reason": "Card verified; 14-day trial started"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": false,
    "cancellation_reason_code": "",
    "created_at": "2026-09-19T10:00:00Z",
    "updated_at": "2026-09-21T09:00:00Z",
    "last_event": "billing_cycle_started",
    "last_event_at": "2026-09-21T09:00:00Z",
    "amount": 4900,
    "currency": "USD",
    "billing_interval": "monthly",
    "payment_status": "pending",
    "payment_method_type": "card",
    "proration_amount": 0,
    "proration_date": 0,
    "next_payment_due_at": "2026-10-05T09:00:00Z",
    "current_period_start": "2026-09-21T09:00:00Z",
    "current_period_end": "2026-10-05T09:00:00Z",
    "current_period_progress": 0.64,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_blueharbor_team",
    "plan_name": "Team",
    "plan_code": "team-monthly",
    "plan_interval": "monthly",
    "customer_name": "Blue Harbor Studio",
    "customer_email": "accounts@blueharbor.example",
    "payment_history": []
  },
  {
    "status": "past_due",
    "state_history": [
      {
        "title": "Trial started",
        "from": "future",
        "to": "trialing",
        "at": "2026-01-20T10:30:00Z",
        "reason": "Started a 14-day Team trial"
      },
      {
        "title": "Trial converted",
        "from": "trialing",
        "to": "active",
        "at": "2026-02-03T10:00:00Z",
        "reason": "First payment collected"
      },
      {
        "title": "Payment failed",
        "from": "active",
        "to": "past_due",
        "at": "2026-09-03T10:00:00Z",
        "reason": "Card declined; retrying"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": false,
    "cancellation_reason_code": "",
    "created_at": "2026-01-20T10:30:00Z",
    "updated_at": "2026-09-03T10:00:00Z",
    "last_event": "billing_cycle_started",
    "last_event_at": "2026-09-03T10:00:00Z",
    "amount": 4900,
    "currency": "GBP",
    "billing_interval": "monthly",
    "payment_status": "retrying",
    "payment_method_type": "card",
    "proration_amount": 0,
    "proration_date": 0,
    "last_payment_at": "2026-08-03T10:00:00Z",
    "next_payment_due_at": "2026-10-01T10:00:00Z",
    "current_period_start": "2026-09-03T10:00:00Z",
    "current_period_end": "2026-10-03T10:00:00Z",
    "current_period_progress": 0.9,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_kestrel_team",
    "plan_name": "Team",
    "plan_code": "team-monthly",
    "plan_interval": "monthly",
    "customer_name": "Kestrel Print Co.",
    "customer_email": "hello@kestrelprint.example",
    "payment_history": [
      {
        "at": "2026-02-03T10:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-03-03T10:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-04-03T10:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-05-03T10:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-06-03T10:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-07-03T10:00:00Z",
        "amount": 4900
      },
      {
        "at": "2026-08-03T10:00:00Z",
        "amount": 4900
      }
    ]
  },
  {
    "status": "active",
    "state_history": [
      {
        "title": "Started",
        "from": "future",
        "to": "active",
        "at": "2024-10-30T14:00:00Z",
        "reason": "Annual Enterprise agreement signed"
      },
      {
        "title": "Invoice overdue",
        "from": "active",
        "to": "past_due",
        "at": "2025-11-14T14:00:00Z",
        "reason": "Renewal invoice unpaid after 15 days"
      },
      {
        "title": "Recovered",
        "from": "past_due",
        "to": "active",
        "at": "2025-11-20T02:00:00Z",
        "reason": "Paid by bank transfer"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": false,
    "cancellation_reason_code": "",
    "created_at": "2024-10-30T14:00:00Z",
    "updated_at": "2025-11-20T02:00:00Z",
    "last_event": "payment_received",
    "last_event_at": "2025-11-20T02:00:00Z",
    "amount": 1200000,
    "currency": "USD",
    "billing_interval": "yearly",
    "payment_status": "succeeded",
    "payment_method_type": "wire",
    "proration_amount": 0,
    "proration_date": 0,
    "last_payment_at": "2025-11-20T02:00:00Z",
    "next_payment_due_at": "2026-10-30T14:00:00Z",
    "current_period_start": "2025-10-30T14:00:00Z",
    "current_period_end": "2026-10-30T14:00:00Z",
    "current_period_progress": 0.92,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_tidewater_enterprise",
    "plan_name": "Enterprise",
    "plan_code": "enterprise-annual",
    "plan_interval": "yearly",
    "customer_name": "Tidewater Co-op",
    "customer_email": "treasurer@tidewater.example",
    "payment_history": [
      {
        "at": "2024-10-30T14:00:00Z",
        "amount": 1200000
      },
      {
        "at": "2025-11-20T02:00:00Z",
        "amount": 1200000
      }
    ]
  },
  {
    "status": "terminated",
    "state_history": [
      {
        "title": "Started",
        "from": "future",
        "to": "active",
        "at": "2026-01-09T10:15:00Z",
        "reason": "Subscribed to the Starter plan"
      },
      {
        "title": "Cancellation requested",
        "from": "active",
        "to": "pending_cancellation",
        "at": "2026-06-20T09:00:00Z",
        "reason": "Closing the studio in July"
      },
      {
        "title": "Ended",
        "from": "pending_cancellation",
        "to": "terminated",
        "at": "2026-07-09T10:15:00Z",
        "reason": "Cancelled at the end of the billing period"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": true,
    "cancellation_reason": "Closing the studio in July",
    "cancellation_reason_code": "",
    "cancellation_requested_at": "2026-06-20T09:00:00Z",
    "created_at": "2026-01-09T10:15:00Z",
    "updated_at": "2026-07-09T10:15:00Z",
    "last_event": "billing_cycle_completed",
    "last_event_at": "2026-07-09T10:15:00Z",
    "amount": 1900,
    "currency": "USD",
    "billing_interval": "monthly",
    "payment_status": "succeeded",
    "payment_method_type": "card",
    "proration_amount": 0,
    "proration_date": 0,
    "last_payment_at": "2026-06-09T10:15:00Z",
    "current_period_start": "2026-06-09T10:15:00Z",
    "current_period_end": "2026-07-09T10:15:00Z",
    "current_period_progress": 1,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_marlow_starter",
    "plan_name": "Starter",
    "plan_code": "starter-monthly",
    "plan_interval": "monthly",
    "customer_name": "Marlow Yoga",
    "customer_email": "studio@marlowyoga.example",
    "payment_history": [
      {
        "at": "2026-01-09T10:15:00Z",
        "amount": 1900
      },
      {
        "at": "2026-02-09T10:15:00Z",
        "amount": 1900
      },
      {
        "at": "2026-03-09T10:15:00Z",
        "amount": 1900
      },
      {
        "at": "2026-04-09T10:15:00Z",
        "amount": 1900
      },
      {
        "at": "2026-05-09T10:15:00Z",
        "amount": 1900
      },
      {
        "at": "2026-06-09T10:15:00Z",
        "amount": 1900
      }
    ]
  },
  {
    "status": "pending_cancellation",
    "state_history": [
      {
        "title": "Trial started",
        "from": "future",
        "to": "trialing",
        "at": "2026-04-23T12:30:00Z",
        "reason": "Started a 14-day Business trial"
      },
      {
        "title": "Trial converted",
        "from": "trialing",
        "to": "active",
        "at": "2026-05-07T12:00:00Z",
        "reason": "First payment collected"
      },
      {
        "title": "Cancellation requested",
        "from": "active",
        "to": "pending_cancellation",
        "at": "2026-09-21T16:40:00Z",
        "reason": "Moving to an annual contract elsewhere"
      }
    ],
    "allowed_transitions": [],
    "cancel_at_period_end": true,
    "cancellation_reason": "Moving to an annual contract elsewhere",
    "cancellation_reason_code": "",
    "cancellation_requested_at": "2026-09-21T16:40:00Z",
    "created_at": "2026-04-23T12:30:00Z",
    "updated_at": "2026-09-21T16:40:00Z",
    "last_event": "cancellation_requested",
    "last_event_at": "2026-09-21T16:40:00Z",
    "amount": 14900,
    "currency": "USD",
    "billing_interval": "monthly",
    "payment_status": "succeeded",
    "payment_method_type": "card",
    "proration_amount": 0,
    "proration_date": 0,
    "last_payment_at": "2026-09-07T12:00:00Z",
    "current_period_start": "2026-09-07T12:00:00Z",
    "current_period_end": "2026-10-07T12:00:00Z",
    "current_period_progress": 0.77,
    "is_archived": false,
    "archived_at": null,
    "restored_at": null,
    "archive_reason": "",
    "archived_by": "",
    "archive_metadata": {},
    "restoration_metadata": {},
    "subscription_id": "sub_summit_business",
    "plan_name": "Business",
    "plan_code": "business-monthly",
    "plan_interval": "monthly",
    "customer_name": "Summit Outfitters",
    "customer_email": "ap@summit.example",
    "payment_history": [
      {
        "at": "2026-05-07T12:00:00Z",
        "amount": 14900
      },
      {
        "at": "2026-06-07T12:00:00Z",
        "amount": 14900
      },
      {
        "at": "2026-07-07T12:00:00Z",
        "amount": 14900
      },
      {
        "at": "2026-08-07T12:00:00Z",
        "amount": 14900
      },
      {
        "at": "2026-09-07T12:00:00Z",
        "amount": 14900
      }
    ]
  }
];
