# legal_data.py
# Person 2B — Hardcoded legal database and authority routing map
# Contains NZ legislation relevant to Auckland civic complaints

LEGAL_DATABASE = {
    "Infrastructure & Roading": {
        "Pothole": {
            "laws": [
                {
                    "act": "Local Government Act 2002",
                    "section": "s 11A(a)",
                    "says": "A local authority must have particular regard to the contribution that core services make to its communities, including network infrastructure (roads, water, sewerage).",
                    "council_must": "Maintain road surfaces to a safe standard as part of core infrastructure obligations.",
                    "timeframe": "Assessed and scheduled for repair within 10 working days for non-urgent defects; urgent hazards within 24 hours."
                },
                {
                    "act": "Land Transport Management Act 2003",
                    "section": "s 95",
                    "says": "Road controlling authorities must ensure roads under their control are safe and efficient for all users.",
                    "council_must": "Repair road defects that pose a safety risk to motorists, cyclists, and pedestrians.",
                    "timeframe": "Immediate temporary measures for high-severity defects; permanent repair within 20 working days."
                }
            ]
        },
        "Streetlight": {
            "laws": [
                {
                    "act": "Local Government Act 2002",
                    "section": "s 11A(a)",
                    "says": "Core services include network infrastructure, which encompasses street lighting as part of the roading corridor.",
                    "council_must": "Maintain street lighting to ensure public safety on roads and footpaths.",
                    "timeframe": "Reported faults assessed within 5 working days; repair within 15 working days."
                },
                {
                    "act": "Electricity Act 1992",
                    "section": "s 23",
                    "says": "Owners of electrical installations must ensure they are maintained in a safe condition.",
                    "council_must": "Ensure streetlight electrical installations are safe and operational.",
                    "timeframe": "Immediate action for exposed wiring or electrical hazards; routine faults within 15 working days."
                }
            ]
        },
        "Footpath": {
            "laws": [
                {
                    "act": "Local Government Act 2002",
                    "section": "s 11A(a)",
                    "says": "Network infrastructure includes footpaths as core transport corridors for pedestrians.",
                    "council_must": "Maintain footpaths to a safe and accessible standard for all users, including those with mobility impairments.",
                    "timeframe": "Hazardous defects assessed within 5 working days; repair within 20 working days."
                },
                {
                    "act": "Health and Safety at Work Act 2015",
                    "section": "s 36",
                    "says": "A person conducting a business or undertaking must ensure, so far as is reasonably practicable, that the health and safety of other persons is not put at risk.",
                    "council_must": "Ensure footpath defects do not create trip or fall hazards to the public.",
                    "timeframe": "Immediate temporary measures for serious trip hazards; permanent repair scheduled within 20 working days."
                }
            ]
        },
        "Parking infringement": {
            "laws": [
                {
                    "act": "Land Transport Act 1998",
                    "section": "s 133",
                    "says": "Territorial authorities are empowered to enforce parking restrictions within their districts.",
                    "council_must": "Enforce parking bylaws and respond to complaints about illegal parking that obstructs access or creates hazards.",
                    "timeframe": "Investigation within 5 working days of a complaint."
                }
            ]
        },
        "Road damage": {
            "laws": [
                {
                    "act": "Local Government Act 2002",
                    "section": "s 11A(a)",
                    "says": "Core services include the maintenance of road infrastructure.",
                    "council_must": "Assess and repair road damage that compromises safety or usability.",
                    "timeframe": "Emergency damage assessed within 24 hours; scheduled repair within 15 working days."
                },
                {
                    "act": "Land Transport Management Act 2003",
                    "section": "s 95",
                    "says": "Road controlling authorities must ensure roads are safe and efficient.",
                    "council_must": "Restore damaged road sections to safe operating condition.",
                    "timeframe": "Temporary measures within 48 hours for serious damage; full repair within 20 working days."
                }
            ]
        }
    },
    "Rubbish & Recycling": {
        "Missed collection": {
            "laws": [
                {
                    "act": "Waste Minimisation Act 2008",
                    "section": "s 42",
                    "says": "Territorial authorities must promote effective and efficient waste management and minimisation within their district.",
                    "council_must": "Ensure contracted waste collection services operate reliably and address missed collections promptly.",
                    "timeframe": "Missed collection resolved within 2 working days of notification."
                }
            ]
        },
        "Illegal dumping": {
            "laws": [
                {
                    "act": "Waste Minimisation Act 2008",
                    "section": "s 49",
                    "says": "No person may deposit waste on land or in water in a manner that is likely to cause adverse effects on human health or the environment.",
                    "council_must": "Investigate and arrange removal of illegally dumped waste; take enforcement action where the offender can be identified.",
                    "timeframe": "Assessment within 5 working days; removal of hazardous dumping within 48 hours."
                },
                {
                    "act": "Resource Management Act 1991",
                    "section": "s 15(1)",
                    "says": "No person may discharge any contaminant onto or into land in circumstances that may result in that contaminant entering water.",
                    "council_must": "Prevent environmental contamination from illegally dumped waste, particularly near waterways.",
                    "timeframe": "Immediate response for dumping near waterways; standard removal within 10 working days."
                }
            ]
        },
        "Bin damage": {
            "laws": [
                {
                    "act": "Waste Minimisation Act 2008",
                    "section": "s 42",
                    "says": "Territorial authorities are responsible for effective and efficient waste management services.",
                    "council_must": "Replace or repair council-issued bins damaged by collection services.",
                    "timeframe": "Replacement bin delivered within 10 working days."
                }
            ]
        },
        "Hazardous waste": {
            "laws": [
                {
                    "act": "Hazardous Substances and New Organisms Act 1996",
                    "section": "s 12",
                    "says": "Hazardous substances must be managed to prevent adverse effects on people and the environment.",
                    "council_must": "Coordinate safe collection and disposal of hazardous household waste; provide public drop-off facilities.",
                    "timeframe": "Urgent hazards (asbestos, chemicals) assessed within 24 hours; routine hazardous waste collection within 10 working days."
                },
                {
                    "act": "Health Act 1956",
                    "section": "s 29",
                    "says": "Local authorities are responsible for removing nuisances that may be injurious to health.",
                    "council_must": "Remove or arrange disposal of hazardous materials that pose a public health risk.",
                    "timeframe": "Immediate action for imminent health risks; standard response within 5 working days."
                }
            ]
        }
    },
    "Property & Rates": {
        "Rates dispute": {
            "laws": [
                {
                    "act": "Local Government (Rating) Act 2002",
                    "section": "s 29",
                    "says": "Rates must be set in accordance with the council's funding impact statement and rating policies.",
                    "council_must": "Review rates disputes and provide a formal response with reasoning.",
                    "timeframe": "Acknowledgement within 5 working days; formal response within 20 working days."
                }
            ]
        },
        "Valuation complaint": {
            "laws": [
                {
                    "act": "Rating Valuations Act 1998",
                    "section": "s 34",
                    "says": "An owner or ratepayer may object to the valuation of their property.",
                    "council_must": "Process valuation objections and refer to the Valuer-General if not resolved.",
                    "timeframe": "Objection must be lodged within specific timeframes; council must respond within 20 working days."
                }
            ]
        },
        "Property compliance": {
            "laws": [
                {
                    "act": "Building Act 2004",
                    "section": "s 164",
                    "says": "A territorial authority may issue a notice to fix if building work does not comply with the building consent or the building code.",
                    "council_must": "Investigate reported non-compliant buildings and issue notices to fix where appropriate.",
                    "timeframe": "Investigation within 15 working days; notice to fix issued within 10 working days of confirmed non-compliance."
                }
            ]
        },
        "Boundary issue": {
            "laws": [
                {
                    "act": "Property Law Act 2007",
                    "section": "s 327",
                    "says": "Boundary disputes may be referred to the District Court for resolution.",
                    "council_must": "Provide information on boundary dispute resolution processes and refer to surveyor or mediation services.",
                    "timeframe": "Response with guidance within 10 working days."
                }
            ]
        }
    },
    "Resource & Building Consents": {
        "Consent delay": {
            "laws": [
                {
                    "act": "Building Act 2004",
                    "section": "s 48",
                    "says": "A building consent authority must grant or refuse a building consent within 20 working days after receiving the application.",
                    "council_must": "Process building consent applications within the statutory 20 working day timeframe.",
                    "timeframe": "20 working days from receipt of a complete application."
                },
                {
                    "act": "Resource Management Act 1991",
                    "section": "s 115",
                    "says": "Resource consent applications must be processed within statutory timeframes.",
                    "council_must": "Make decisions on non-notified resource consents within 20 working days.",
                    "timeframe": "20 working days for non-notified consents; longer timeframes apply for notified consents."
                }
            ]
        },
        "Inspection issue": {
            "laws": [
                {
                    "act": "Building Act 2004",
                    "section": "s 90",
                    "says": "A building consent authority must carry out inspections of building work to ensure compliance.",
                    "council_must": "Schedule and complete inspections within reasonable timeframes to avoid construction delays.",
                    "timeframe": "Inspection booked within 5 working days of request."
                }
            ]
        },
        "Building fine dispute": {
            "laws": [
                {
                    "act": "Building Act 2004",
                    "section": "s 372",
                    "says": "Offences under the Building Act may result in fines; affected parties have the right to challenge penalties.",
                    "council_must": "Provide clear reasoning for any fines or penalties issued and inform of appeal rights.",
                    "timeframe": "Formal response to disputes within 15 working days."
                }
            ]
        },
        "Consent decision disagreement": {
            "laws": [
                {
                    "act": "Building Act 2004",
                    "section": "s 177",
                    "says": "A person may apply to the Chief Executive of MBIE for a determination on matters relating to building consents.",
                    "council_must": "Inform the applicant of their right to seek a determination from MBIE.",
                    "timeframe": "Acknowledge disagreement within 5 working days; provide information on determination process within 10 working days."
                }
            ]
        }
    },
    "Noise Complaints": {
        "Residential noise": {
            "laws": [
                {
                    "act": "Resource Management Act 1991",
                    "section": "s 326",
                    "says": "An enforcement officer may issue an excessive noise direction requiring the noise to be reduced to a reasonable level.",
                    "council_must": "Respond to excessive noise complaints and issue noise abatement directions where warranted.",
                    "timeframe": "Response within 1 hour for after-hours noise complaints; follow-up action within 5 working days for recurring issues."
                },
                {
                    "act": "Auckland Council District Plan (Operative in Part)",
                    "section": "Chapter E25 — Noise and Vibration",
                    "says": "Activities must comply with noise limits specified for the relevant zone.",
                    "council_must": "Enforce district plan noise limits and investigate reported breaches.",
                    "timeframe": "Initial response within 24 hours; investigation within 5 working days."
                }
            ]
        },
        "Commercial noise": {
            "laws": [
                {
                    "act": "Resource Management Act 1991",
                    "section": "s 16",
                    "says": "Every occupier of land shall adopt the best practicable option to ensure that emission of noise does not exceed a reasonable level.",
                    "council_must": "Investigate commercial noise complaints and enforce compliance with district plan noise limits.",
                    "timeframe": "Investigation within 10 working days; enforcement action if non-compliance confirmed."
                }
            ]
        },
        "Construction noise": {
            "laws": [
                {
                    "act": "Resource Management Act 1991",
                    "section": "s 16",
                    "says": "Occupiers must adopt the best practicable option to minimise noise emissions.",
                    "council_must": "Enforce construction noise limits as set out in NZS 6803:1999 and the district plan.",
                    "timeframe": "Response within 2 working days; enforcement action for breaches of permitted hours."
                },
                {
                    "act": "Auckland Council District Plan (Operative in Part)",
                    "section": "Chapter E25.6.8 — Construction Noise",
                    "says": "Construction noise must comply with NZS 6803:1999 Acoustics — Construction Noise.",
                    "council_must": "Monitor and enforce construction noise compliance, particularly outside permitted hours (7:30am–6pm weekdays, 8am–6pm Saturdays).",
                    "timeframe": "Investigation within 2 working days."
                }
            ]
        },
        "Event noise": {
            "laws": [
                {
                    "act": "Resource Management Act 1991",
                    "section": "s 16",
                    "says": "Noise emissions must not exceed a reasonable level.",
                    "council_must": "Ensure event organisers comply with resource consent noise conditions and district plan requirements.",
                    "timeframe": "Real-time response during events; post-event investigation within 5 working days."
                }
            ]
        }
    }
}


AUTHORITY_MAP = {
    "Infrastructure & Roading": {
        "department": "Auckland Transport / Auckland Council Infrastructure",
        "email": "infrastructure@aucklandcouncil.govt.nz",
        "escalation_email": "complaints@oag.parliament.nz",
        "response_timeframe": "15 working days",
        "escalation_body": "the Office of the Ombudsman"
    },
    "Rubbish & Recycling": {
        "department": "Auckland Council Waste Solutions",
        "email": "wastesolutions@aucklandcouncil.govt.nz",
        "escalation_email": "complaints@oag.parliament.nz",
        "response_timeframe": "10 working days",
        "escalation_body": "the Office of the Ombudsman"
    },
    "Property & Rates": {
        "department": "Auckland Council Rates and Property",
        "email": "rates@aucklandcouncil.govt.nz",
        "escalation_email": "complaints@oag.parliament.nz",
        "response_timeframe": "20 working days",
        "escalation_body": "the Office of the Ombudsman"
    },
    "Resource & Building Consents": {
        "department": "Auckland Council Building Consents",
        "email": "buildingconsents@aucklandcouncil.govt.nz",
        "escalation_email": "complaints@oag.parliament.nz",
        "response_timeframe": "20 working days",
        "escalation_body": "the Office of the Ombudsman"
    },
    "Noise Complaints": {
        "department": "Auckland Council Noise Control / Regulatory Services",
        "email": "noisecontrol@aucklandcouncil.govt.nz",
        "escalation_email": "complaints@oag.parliament.nz",
        "response_timeframe": "10 working days",
        "escalation_body": "the Office of the Ombudsman"
    }
}
