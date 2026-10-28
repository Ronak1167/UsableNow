from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.entities import Facility, Feature, Report


def seed_database(db: Session, force_reset: bool = True) -> Dict[str, int]:
    """
    Populates database with at least 12 illustrative demonstration campus facilities
    with varied real-world-style report histories to demonstrate all reliability states.
    All records are flagged as is_demo_data = True.
    """
    if force_reset:
        db.query(Report).delete()
        db.query(Feature).delete()
        db.query(Facility).delete()
        db.commit()

    # If already seeded and not force_reset, skip
    if db.query(Facility).count() >= 15:
        return {
            "facilities": db.query(Facility).count(),
            "features": db.query(Feature).count(),
            "reports": db.query(Report).count(),
            "status": "already_seeded"
        }

    now = datetime.now(timezone.utc)

    # 14 Seed Facilities across campus
    facilities_data = [
        {
            "id": "fac_01",
            "latitude": 28.6297,
            "longitude": 77.3721,
            "name": "ABB-I Ground Floor RO Water Station",
            "description": "High-capacity chilled RO drinking water dispenser located near Lecture Hall 1 entrance.",
            "facility_type": "Drinking Water",
            "building_or_area": "ABB-I Ground Floor",
            "opening_hours": "6:00 AM - 11:00 PM",
            "features": [
                {
                    "id": "feat_01_water",
                    "feature_type": "drinking_water",
                    "display_name": "Cold RO Drinking Water Station",
                    "description": "Chilled drinking water dispenser with dual faucets"
                }
            ],
            "reports": [
                # 3 recent independent agreeing reports -> LIKELY_WORKING, High confidence
                {"feature_id": "feat_01_water", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 0.8, "note": "Cold water flowing properly, purifier indicator green.", "ip": "ip_stud_101"},
                {"feature_id": "feat_01_water", "status": "WORKING", "source": "ON_SITE_OBSERVATION", "hours_ago": 1.5, "note": "Filled 1L bottle smoothly, good flow.", "ip": "ip_stud_102"},
                {"feature_id": "feat_01_water", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 2.2, "note": "Working normally.", "ip": "ip_stud_103"}
            ]
        },
        {
            "id": "fac_02",
            "latitude": 28.6304,
            "longitude": 77.3718,
            "name": "Learning Resource Centre (LRC) Printing Hub",
            "description": "Campus digital print & copy station located on LRC 1st Floor.",
            "facility_type": "Printing Station",
            "building_or_area": "LRC Library 1st Floor",
            "opening_hours": "8:30 AM - 9:30 PM",
            "features": [
                {
                    "id": "feat_02_printer",
                    "feature_type": "printer",
                    "display_name": "Networked B&W & Color Laser Printer",
                    "description": "High-speed laser printer supporting mobile & USB print jobs"
                }
            ],
            "reports": [
                # Fresh UNAVAILABLE report -> LIKELY_UNAVAILABLE, Medium/High
                {"feature_id": "feat_02_printer", "status": "UNAVAILABLE", "source": "STUDENT_REPORT", "hours_ago": 0.5, "note": "Paper jam and out of black toner. Red warning flashing.", "ip": "ip_stud_201"},
                {"feature_id": "feat_02_printer", "status": "UNAVAILABLE", "source": "ON_SITE_OBSERVATION", "hours_ago": 1.2, "note": "Operator away, printer queuing jobs without printing.", "ip": "ip_stud_202"}
            ]
        },
        {
            "id": "fac_03",
            "latitude": 28.6294,
            "longitude": 77.3728,
            "name": "ABB-II West Wing Lift B",
            "description": "Passenger elevator connecting Ground Floor to 6th Floor faculty rooms and labs.",
            "facility_type": "Elevator / Lift",
            "building_or_area": "ABB-II West Wing",
            "opening_hours": "24/7",
            "features": [
                {
                    "id": "feat_03_lift",
                    "feature_type": "lift",
                    "display_name": "Passenger Elevator B",
                    "description": "10-passenger motorized lift with braille buttons"
                }
            ],
            "reports": [
                # CONFLICTING fresh reports: 1 working vs 1 unavailable within 2 hours
                {"feature_id": "feat_03_lift", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 2.0, "note": "Used it to reach 4th floor labs.", "ip": "ip_stud_301"},
                {"feature_id": "feat_03_lift", "status": "UNAVAILABLE", "source": "STUDENT_REPORT", "hours_ago": 0.6, "note": "Doors stuck on 2nd floor, caution tape placed.", "ip": "ip_stud_302"}
            ]
        },
        {
            "id": "fac_04",
            "name": "Aryabhatt Academic Block Step-Free Ramp Entrance",
            "description": "Wheelchair-accessible gently sloped ramp and automatic entrance doors.",
            "facility_type": "Step-Free Access",
            "building_or_area": "Aryabhatt Block North Entrance",
            "opening_hours": "24/7",
            "features": [
                {
                    "id": "feat_04_ramp",
                    "feature_type": "step_free_access",
                    "display_name": "Main North Ramp & Wide Entrance",
                    "description": "Gradient 1:12 ramp with twin handrails and step-free automatic sliding door"
                }
            ],
            "reports": [
                # Physical feature with 48h half-life -> verified recently, LIKELY_WORKING
                {"feature_id": "feat_04_ramp", "status": "WORKING", "source": "ON_SITE_OBSERVATION", "hours_ago": 4.0, "note": "Ramp completely clear of obstacles, automatic sensor door opening smoothly.", "ip": "ip_stud_401"},
                {"feature_id": "feat_04_ramp", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 14.0, "note": "Accessible entrance in good condition.", "ip": "ip_stud_402"}
            ]
        },
        {
            "id": "fac_05",
            "latitude": 28.6291,
            "longitude": 77.3715,
            "name": "Jaypee Annexe 3rd Floor Water Cooler",
            "description": "Water point near Faculty Cubicles in Annexe II.",
            "facility_type": "Drinking Water",
            "building_or_area": "Annexe II 3rd Floor",
            "opening_hours": "7:00 AM - 10:00 PM",
            "features": [
                {
                    "id": "feat_05_water",
                    "feature_type": "drinking_water",
                    "display_name": "Commercial Water Cooler",
                    "description": "Stainless steel water dispenser with purification unit"
                }
            ],
            "reports": [
                # STALE DECAYED: report is 38 hours old (>> 6h half-life) -> UNKNOWN (Stale)
                {"feature_id": "feat_05_water", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 38.0, "note": "Working yesterday morning.", "ip": "ip_stud_501"}
            ]
        },
        {
            "id": "fac_06",
            "latitude": 28.631,
            "longitude": 77.3732,
            "name": "Shastri Hostel Ground Floor Accessible Restroom",
            "description": "Specially designed barrier-free washroom with handrails and emergency pull cord.",
            "facility_type": "Accessible Restroom",
            "building_or_area": "Shastri Hostel Block A",
            "opening_hours": "24/7",
            "features": [
                {
                    "id": "feat_06_washroom",
                    "feature_type": "accessible_washroom",
                    "display_name": "Accessible Stall & Grab Bars",
                    "description": "Extra-wide stall with support grab rails, non-slip tile flooring, and low sink"
                }
            ],
            "reports": [
                # High confidence LIKELY_WORKING from independent student and observation reports
                {"feature_id": "feat_06_washroom", "status": "WORKING", "source": "ON_SITE_OBSERVATION", "hours_ago": 2.5, "note": "Clean, running water available, grab rails intact and secure.", "ip": "ip_stud_601"},
                {"feature_id": "feat_06_washroom", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 5.0, "note": "Lock works fine, soap dispenser refilled.", "ip": "ip_stud_602"}
            ]
        },
        {
            "id": "fac_07",
            "latitude": 28.6288,
            "longitude": 77.3725,
            "name": "Cafeteria Tech Lounge Power Hub",
            "description": "Dedicated laptop bar equipped with surge-protected AC sockets and USB ports.",
            "facility_type": "Charging Hub",
            "building_or_area": "Student Cafeteria Upper Mezzanine",
            "opening_hours": "8:00 AM - 11:30 PM",
            "features": [
                {
                    "id": "feat_07_charging",
                    "feature_type": "charging_point",
                    "display_name": "AC Laptop Sockets & USB-C Ports",
                    "description": "Multi-plug power strips along the high-top desks"
                }
            ],
            "reports": [
                # Multiple reports agreeing working
                {"feature_id": "feat_07_charging", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 1.0, "note": "Plugs 1 through 6 energized and charging at normal speed.", "ip": "ip_stud_701"},
                {"feature_id": "feat_07_charging", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 3.0, "note": "Charged MacBook without issue.", "ip": "ip_stud_702"}
            ]
        },
        {
            "id": "fac_08",
            "latitude": 28.6315,
            "longitude": 77.373,
            "name": "Tagore Hostel Silent Study Pods",
            "description": "Acoustic-treated quiet study cubicles with individual task lighting.",
            "facility_type": "Study Space",
            "building_or_area": "Tagore Hostel 2nd Floor Lounge",
            "opening_hours": "24/7",
            "features": [
                {
                    "id": "feat_08_study",
                    "feature_type": "study_space",
                    "display_name": "Silent Individual Study Cubicles",
                    "description": "Partially partitioned cubicles for focused reading"
                }
            ],
            "reports": [
                # NO REPORTS AT ALL -> UNKNOWN ("Unknown does not mean unavailable")
            ]
        },
        {
            "id": "fac_09",
            "latitude": 28.62975,
            "longitude": 77.3722,
            "name": "ABB-I Central Atrium Multifunction Hub",
            "description": "Central concourse featuring drinking water, quick-print kiosk, and public Wi-Fi.",
            "facility_type": "Campus Concourse",
            "building_or_area": "ABB-I Central Atrium",
            "opening_hours": "7:00 AM - 10:00 PM",
            "features": [
                # Facility with multiple features in DIFFERENT states!
                {
                    "id": "feat_09_water",
                    "feature_type": "drinking_water",
                    "display_name": "Atrium Chilled Water Cooler",
                    "description": "Cold RO water dispenser"
                },
                {
                    "id": "feat_09_printer",
                    "feature_type": "printer",
                    "display_name": "Self-Service Printing Kiosk",
                    "description": "Touchscreen kiosk for document printing"
                },
                {
                    "id": "feat_09_wifi",
                    "feature_type": "wifi",
                    "display_name": "High-Density Campus Wi-Fi AP",
                    "description": "Dual-band 802.11ax wireless access point"
                }
            ],
            "reports": [
                # Water is LIKELY_WORKING
                {"feature_id": "feat_09_water", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 1.1, "note": "Water is chilled and clean.", "ip": "ip_stud_901"},
                {"feature_id": "feat_09_water", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 2.8, "note": "Good pressure.", "ip": "ip_stud_902"},
                # Printer is LIKELY_UNAVAILABLE
                {"feature_id": "feat_09_printer", "status": "UNAVAILABLE", "source": "STUDENT_REPORT", "hours_ago": 0.9, "note": "Screen frozen on boot logo, card reader unresponsive.", "ip": "ip_stud_903"},
                # Wi-Fi only has UNCERTAIN report -> UNKNOWN
                {"feature_id": "feat_09_wifi", "status": "UNCERTAIN", "source": "STUDENT_REPORT", "hours_ago": 1.4, "note": "High latency and dropping packets during peak lecture change.", "ip": "ip_stud_904"}
            ]
        },
        {
            "id": "fac_10",
            "latitude": 28.6308,
            "longitude": 77.374,
            "name": "Sarojini Hostel Outdoor Wi-Fi Canopy",
            "description": "Covered garden sitting area with outdoor Wi-Fi coverage.",
            "facility_type": "Wireless Network Hub",
            "building_or_area": "Girls Hostel Courtyard",
            "opening_hours": "6:00 AM - 10:30 PM",
            "features": [
                {
                    "id": "feat_10_wifi",
                    "feature_type": "wifi",
                    "display_name": "Courtyard Outdoor Wi-Fi AP",
                    "description": "Weather-proof outdoor wireless access node"
                }
            ],
            "reports": [
                # Single report working -> Medium confidence (capped single report safeguard)
                {"feature_id": "feat_10_wifi", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 1.8, "note": "Solid 45 Mbps download speed near bench 3.", "ip": "ip_stud_1001"}
            ]
        },
        {
            "id": "fac_11",
            "latitude": 28.6318,
            "longitude": 77.3712,
            "name": "Sports Complex Mezzanine Water Station",
            "description": "Water point with sports bottle filler neck on the badminton court gallery.",
            "facility_type": "Drinking Water",
            "building_or_area": "Sports Complex 1st Floor",
            "opening_hours": "6:00 AM - 9:00 PM",
            "features": [
                {
                    "id": "feat_11_water",
                    "feature_type": "drinking_water",
                    "display_name": "Sports Bottle Fast Refill Tap",
                    "description": "High-flow cold water tap with bottle sensor"
                }
            ],
            "reports": [
                # ONLY UNCERTAIN report
                {"feature_id": "feat_11_water", "status": "UNCERTAIN", "source": "STUDENT_REPORT", "hours_ago": 2.0, "note": "Water trickle is very slow, took 3 mins to fill half a bottle.", "ip": "ip_stud_1101"}
            ]
        },
        {
            "id": "fac_12",
            "latitude": 28.62945,
            "longitude": 77.37275,
            "name": "Computer Centre Lab 3 Printer Station",
            "description": "Departmental printing desk for lab assignments and project reports.",
            "facility_type": "Printing Station",
            "building_or_area": "ABB-II 2nd Floor Lab 3",
            "opening_hours": "9:00 AM - 6:00 PM",
            "features": [
                {
                    "id": "feat_12_printer",
                    "feature_type": "printer",
                    "display_name": "HP LaserJet Departmental Unit",
                    "description": "Heavy-duty monochrome printer for student project submissions"
                }
            ],
            "reports": [
                # Multiple agreeing working reports
                {"feature_id": "feat_12_printer", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 1.2, "note": "Prints fast, plenty of paper in tray 2.", "ip": "ip_stud_1201"},
                {"feature_id": "feat_12_printer", "status": "WORKING", "source": "ON_SITE_OBSERVATION", "hours_ago": 3.1, "note": "Printed 15 pages without glitch.", "ip": "ip_stud_1202"}
            ]
        },
        {
            "id": "fac_13",
            "latitude": 28.6295,
            "longitude": 77.3719,
            "name": "Lecture Hall Complex Step-Free East Ramp",
            "description": "Wide, gently inclined ramp serving the main lecture theatres.",
            "facility_type": "Step-Free Access",
            "building_or_area": "Lecture Hall Complex East",
            "opening_hours": "7:00 AM - 9:00 PM",
            "features": [
                {
                    "id": "feat_13_ramp",
                    "feature_type": "step_free_access",
                    "display_name": "East Concourse Wheelchair Ramp",
                    "description": "Non-slip surface ramp with tactile ground indicators"
                }
            ],
            "reports": [
                # Fresh UNAVAILABLE report: ramp blocked by construction material
                {"feature_id": "feat_13_ramp", "status": "UNAVAILABLE", "source": "STUDENT_REPORT", "hours_ago": 2.2, "note": "Maintenance scaffolding currently blocking the lower ramp incline.", "ip": "ip_stud_1301"}
            ]
        },
        {
            "id": "fac_14",
            "latitude": 28.63035,
            "longitude": 77.37175,
            "name": "Central Library 2nd Floor Quiet Study Zone",
            "description": "Individual cubicles with power sockets and ergonomic task chairs.",
            "facility_type": "Study Space",
            "building_or_area": "LRC Library 2nd Floor",
            "opening_hours": "8:30 AM - 10:00 PM",
            "features": [
                {
                    "id": "feat_14_study",
                    "feature_type": "study_space",
                    "display_name": "Individual Silent Study Desks",
                    "description": "Partitioned desks with individual overhead lighting"
                },
                {
                    "id": "feat_14_charging",
                    "feature_type": "charging_point",
                    "display_name": "Desk Power Outlets",
                    "description": "Universal 3-pin sockets mounted on each desk panel"
                }
            ],
            "reports": [
                {"feature_id": "feat_14_study", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 1.5, "note": "Quiet environment, air conditioning working well.", "ip": "ip_stud_1401"},
                {"feature_id": "feat_14_study", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 3.0, "note": "Desks available and clean.", "ip": "ip_stud_1402"},
                {"feature_id": "feat_14_charging", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 1.5, "note": "Desk sockets working fine.", "ip": "ip_stud_1401"}
            ]
        },
        # ── LAUNDRY FACILITIES (new for Lumina '26 feature parity) ──────────────
        {
            "id": "fac_15",
            "latitude": 28.6311,
            "longitude": 77.3733,
            "name": "Shastri Hostel Block B Laundry Room",
            "description": "Ground-floor self-service laundry facility with 6 front-loading washers and 4 dryers. Coin-operated. Wash cycle approx. 45 min, dry cycle approx. 35 min.",
            "facility_type": "Campus Laundry",
            "building_or_area": "Shastri Hostel Block B",
            "opening_hours": "6:00 AM - 11:00 PM",
            "features": [
                {
                    "id": "feat_15_laundry_machines",
                    "feature_type": "laundry_machines",
                    "display_name": "Front-Load Washers & Dryers",
                    "description": "6 washers + 4 dryers. Wash ~45 min, Dry ~35 min. ₹20/cycle coin-op."
                },
                {
                    "id": "feat_15_laundry_crowd",
                    "feature_type": "laundry_crowd",
                    "display_name": "Crowd Level",
                    "description": "Current busyness of the laundry room (Low / Medium / High)"
                }
            ],
            "reports": [
                # Multiple agreeing working reports for machines → LIKELY_WORKING
                {"feature_id": "feat_15_laundry_machines", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 0.5, "note": "3 washers free, dryers working. Ready for wash.", "crowd_level": "Low", "laundry_status": "Ready", "estimated_time": "Ready now (~45 min cycle)", "ip": "ip_stud_1501"},
                {"feature_id": "feat_15_laundry_machines", "status": "WORKING", "source": "ON_SITE_OBSERVATION", "hours_ago": 1.2, "note": "All machines functional. Slight delay on dryer 2.", "crowd_level": "Low", "laundry_status": "Ready", "estimated_time": "Available for next cycle", "ip": "ip_stud_1502"},
                # Crowd is Medium — fresh single report
                {"feature_id": "feat_15_laundry_crowd", "status": "UNCERTAIN", "source": "STUDENT_REPORT", "hours_ago": 0.6, "note": "Medium crowd — about 4 people waiting. Estimated wait ~15 mins.", "crowd_level": "Medium", "laundry_status": "Ready", "estimated_time": "Est. ready/pickup ~5:15 PM", "ip": "ip_stud_1503"}
            ]
        },
        {
            "id": "fac_16",
            "latitude": 28.6316,
            "longitude": 77.3731,
            "name": "Tagore Hostel Laundry Hub",
            "description": "First-floor laundry facility with 4 semi-automatic washers. Shared by Tagore and Gandhi hostel residents. Typically busy on weekends.",
            "facility_type": "Campus Laundry",
            "building_or_area": "Tagore Hostel 1st Floor",
            "opening_hours": "7:00 AM - 10:30 PM",
            "features": [
                {
                    "id": "feat_16_laundry_machines",
                    "feature_type": "laundry_machines",
                    "display_name": "Semi-Automatic Washers",
                    "description": "4 semi-automatic washers. Wash cycle ~30 min. Shared tub for wringing."
                },
                {
                    "id": "feat_16_laundry_crowd",
                    "feature_type": "laundry_crowd",
                    "display_name": "Crowd Level",
                    "description": "Current busyness of the laundry room"
                }
            ],
            "reports": [
                # Machine 2 broken — fresh unavailable
                {"feature_id": "feat_16_laundry_machines", "status": "UNAVAILABLE", "source": "STUDENT_REPORT", "hours_ago": 1.0, "note": "Machine 2 out of order, agitator stuck. Others working but heavy demand.", "crowd_level": "High", "laundry_status": "Delayed", "estimated_time": "Cycle delays ~30 mins", "ip": "ip_stud_1601"},
                {"feature_id": "feat_16_laundry_machines", "status": "UNCERTAIN", "source": "STUDENT_REPORT", "hours_ago": 2.5, "note": "2 of 4 washers running fine. Slow spin on machine 3.", "crowd_level": "Medium", "laundry_status": "Not ready", "ip": "ip_stud_1602"},
                # HIGH crowd → UNCERTAIN report captures 'high busyness'
                {"feature_id": "feat_16_laundry_crowd", "status": "UNAVAILABLE", "source": "STUDENT_REPORT", "hours_ago": 0.8, "note": "High crowd — all seats taken, queue of 7+ people. Very busy today.", "crowd_level": "High", "laundry_status": "Delayed", "estimated_time": "Est. queue wait ~40 mins", "ip": "ip_stud_1603"}
            ]
        },
        {
            "id": "fac_17",
            "latitude": 28.63075,
            "longitude": 77.37395,
            "name": "Sarojini Hostel Laundry Corner",
            "description": "Small laundry area with 2 top-load washers on the ground floor. No dryer available — air-dry racks only.",
            "facility_type": "Campus Laundry",
            "building_or_area": "Sarojini Hostel Ground Floor",
            "opening_hours": "6:00 AM - 10:00 PM",
            "features": [
                {
                    "id": "feat_17_laundry_machines",
                    "feature_type": "laundry_machines",
                    "display_name": "Top-Load Washers (No Dryer)",
                    "description": "2 top-load washers. No dryer — air-dry racks available in adjacent room."
                },
                {
                    "id": "feat_17_laundry_crowd",
                    "feature_type": "laundry_crowd",
                    "display_name": "Crowd Level",
                    "description": "Current busyness of the laundry corner"
                }
            ],
            "reports": [
                # No reports for crowd — UNKNOWN
                # Machine: stale single working report → borderline decayed → UNKNOWN
                {"feature_id": "feat_17_laundry_machines", "status": "WORKING", "source": "STUDENT_REPORT", "hours_ago": 9.0, "note": "Both machines working yesterday morning.", "ip": "ip_stud_1701"}
            ]
        }
    ]

    fac_count = 0
    feat_count = 0
    rep_count = 0

    for f_data in facilities_data:
        fac = Facility(
            id=f_data["id"],
            name=f_data["name"],
            description=f_data["description"],
            facility_type=f_data["facility_type"],
            building_or_area=f_data["building_or_area"],
            latitude=f_data.get("latitude"),
            longitude=f_data.get("longitude"),
            opening_hours=f_data.get("opening_hours"),
            is_demo_data=True,
            created_at=now - timedelta(days=7),
            updated_at=now
        )
        db.add(fac)
        fac_count += 1

        for feat_data in f_data["features"]:
            feat = Feature(
                id=feat_data["id"],
                facility_id=fac.id,
                feature_type=feat_data["feature_type"],
                display_name=feat_data["display_name"],
                description=feat_data.get("description"),
                created_at=now - timedelta(days=7)
            )
            db.add(feat)
            feat_count += 1

        for r_data in f_data.get("reports", []):
            rep_time = now - timedelta(hours=r_data["hours_ago"])
            rep = Report(
                facility_id=fac.id,
                feature_id=r_data["feature_id"],
                reported_status=r_data["status"],
                source_type=r_data.get("source", "STUDENT_REPORT"),
                note=r_data.get("note"),
                evidence_url=None,
                is_anonymous=False,
                crowd_level=r_data.get("crowd_level"),
                laundry_status=r_data.get("laundry_status"),
                estimated_time=r_data.get("estimated_time"),
                moderation_status="APPROVED",
                is_demo_data=True,
                created_at=rep_time,
                reporter_ip_hash=r_data.get("ip", "ip_demo")
            )
            db.add(rep)
            rep_count += 1

    db.commit()

    return {
        "facilities": fac_count,
        "features": feat_count,
        "reports": rep_count,
        "status": "seeded_successfully"
    }


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        res = seed_database(db, force_reset=True)
        print("Database seeded:", res)
    finally:
        db.close()
