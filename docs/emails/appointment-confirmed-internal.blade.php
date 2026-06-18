<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>📅 New Appointment Confirmed - V General Contractors</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
        }

        .logo {
            text-align: center;
            margin-bottom: 25px;
        }

        .logo img {
            max-width: 180px;
            height: auto;
        }

        .details {
            line-height: 1.6;
            color: #333333;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            color: #666666;
            font-size: 14px;
        }

        .highlight-blue {
            color: #1e90ff;
            font-weight: bold;
        }

        .appointment-banner {
            background: #e6f4ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .appointment-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .details td {
            padding: 8px 0;
            vertical-align: top;
        }

        .details strong {
            display: inline-block;
            width: 150px;
            color: #4a5568;
        }

        .status-tag {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            background-color: #10b981;
            color: white;
        }

        .action-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1e90ff;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 15px 0;
        }

        .social-icons {
            margin: 20px 0;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }
    </style>
</head>

<body>
    @php
        // Función para formatear números de teléfono españoles
        if (!function_exists('formatSpanishPhone')) {
            function formatSpanishPhone($phoneNumber)
            {
                // Eliminar cualquier espacio existente
                $cleaned = preg_replace('/\s+/', '', $phoneNumber);

                // Si el número comienza con +34, formatearlo correctamente
                if (str_starts_with($cleaned, '+34')) {
                    // Quitar el código de país para trabajar solo con los 9 dígitos
                    $nationalNumber = substr($cleaned, 3);

                    // Aplicar formato +34 XXX XX XX XX
                    if (strlen($nationalNumber) === 9) {
                        return '+34 ' .
                            substr($nationalNumber, 0, 3) .
                            ' ' .
                            substr($nationalNumber, 3, 2) .
                            ' ' .
                            substr($nationalNumber, 5, 2) .
                            ' ' .
                            substr($nationalNumber, 7, 2);
                    }
                }

                // Si no es un número español o no tiene el formato esperado, devolverlo sin cambios
                return $phoneNumber;
            }
        }
    @endphp

    <div class="container">
        <!-- Logo -->
        <div class="logo">
            <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" width="180"
                alt="Logo V General Contractors">
        </div>

        <div class="details">
            <h2 style="color: #1e90ff; text-align: center; border-bottom: 2px solid #1e90ff; padding-bottom: 10px;">
                📅 New Appointment Confirmed
            </h2>

            <div class="appointment-banner">
                <p style="text-align: center; margin: 0;">
                    <strong>A new appointment has been confirmed in the system.</strong>
                </p>
            </div>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Client Information:</h3>
                <table style="width: 100%;">
                    <tr>
                        <td><strong>Client Name:</strong></td>
                        <td>{{ $appointment->first_name }} {{ $appointment->last_name }}</td>
                    </tr>
                    <tr>
                        <td><strong>Email:</strong></td>
                        <td><a href="mailto:{{ $appointment->email }}">{{ $appointment->email }}</a></td>
                    </tr>
                    <tr>
                        <td><strong>Phone:</strong></td>
                        <td>
                            @php
                                $phone = $appointment->phone ?? '';
                                // Remove any non-digit characters
                                $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                                // Format the number based on length
                                if (strlen($digitsOnly) == 10) {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 0, 3) .
                                        ') ' .
                                        substr($digitsOnly, 3, 3) .
                                        '-' .
                                        substr($digitsOnly, 6);
                                } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                    // US number with country code
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 1, 3) .
                                        ') ' .
                                        substr($digitsOnly, 4, 3) .
                                        '-' .
                                        substr($digitsOnly, 7);
                                } else {
                                    // Fallback to original
                                    $formattedPhone = $phone;
                                }
                                echo $formattedPhone;
                            @endphp
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Address:</strong></td>
                        <td>
                            {{ $appointment->address }}
                            @if ($appointment->address_2)
                                <br>{{ $appointment->address_2 }}
                            @endif
                            <br>{{ $appointment->city }}, {{ $appointment->state }} {{ $appointment->zipcode }}
                            <br>{{ $appointment->country }}
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Has Insurance:</strong></td>
                        <td>{{ $appointment->insurance_property ? 'Yes' : 'No' }}</td>
                    </tr>
                    <tr>
                        <td><strong>SMS Consent:</strong></td>
                        <td>{{ $appointment->sms_consent ? 'Yes' : 'No' }}</td>
                    </tr>
                    @if (!empty($appointment->notes))
                        <tr>
                            <td><strong>Notes:</strong></td>
                            <td>{{ $appointment->notes }}</td>
                        </tr>
                    @endif
                </table>
            </div>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Appointment Details:</h3>
                <table style="width: 100%;">

                    <tr>
                        <td><strong>Status:</strong></td>
                        <td><span class="status-tag">Confirmed</span></td>
                    </tr>
                    <tr>
                        <td><strong>Date and Time:</strong></td>
                        <td>
                            @php
                                $inspectionDate = \Carbon\Carbon::parse($appointment->inspection_date);
                                $inspectionTime = \Carbon\Carbon::parse($appointment->inspection_time);
                                $startDateTime = $inspectionDate->setTimeFrom($inspectionTime);
                                $endDateTime = $startDateTime->copy()->addHours(3);
                                $formattedDate = $startDateTime
                                    ->locale('es')
                                    ->isoFormat('dddd D [de] MMMM [de] YYYY [a las] hh:mm A');
                                echo ucfirst($formattedDate);
                            @endphp
                            <br>
                            <small>Duration: 2 hours (until {{ $endDateTime->format('h:i A') }})</small>
                        </td>
                    </tr>
                </table>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #2d3748;">Required Actions:</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Verify team availability for the scheduled date and time</li>
                    <li>Prepare necessary documentation for the inspection</li>
                    <li>Confirm route and travel time to the location</li>
                </ul>
            </div>
        </div>

        <!-- Redes Sociales -->
        <div class="social-icons">
            @if ($companyData->facebook_link)
                <a href="{{ $companyData->facebook_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="30" alt="Facebook">
                </a>
            @endif
            @if ($companyData->instagram_link)
                <a href="{{ $companyData->instagram_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="30" alt="Instagram">
                </a>
            @endif
            @if ($companyData->linkedin_link)
                <a href="{{ $companyData->linkedin_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="30" alt="LinkedIn">
                </a>
            @endif
            @if ($companyData->twitter_link)
                <a href="{{ $companyData->twitter_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="30" alt="Twitter">
                </a>
            @endif
        </div>

        <!-- Pie de Página -->
        <div class="footer">
            <p>Business Hours:<br>
                Monday to Friday: 9:00 AM - 5:00 PM</p>
            <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }} {{ $companyData->company_name }}.
                All rights reserved.</p>
            @if ($companyData->address)
                <p style="font-size: 10px; color: #999;">{{ $companyData->address }}</p>
            @endif

            <div style="margin-top: 5px; font-size: 12px; color: #777;">
                <p style="margin: 3px 0;">
                    @if ($companyData->phone)
                        <span>
                            @php
                                $phone = $companyData->phone ?? '';
                                $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                                if (strlen($digitsOnly) == 10) {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 0, 3) .
                                        ') ' .
                                        substr($digitsOnly, 3, 3) .
                                        '-' .
                                        substr($digitsOnly, 6);
                                } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 1, 3) .
                                        ') ' .
                                        substr($digitsOnly, 4, 3) .
                                        '-' .
                                        substr($digitsOnly, 7);
                                } else {
                                    $formattedPhone = $phone;
                                }
                                echo $formattedPhone;
                            @endphp
                        </span>

                        @if ($companyData->email)
                            <span style="margin: 0 5px;">|</span>
                        @endif
                    @endif

                    @if ($companyData->email)
                        <a href="mailto:{{ $companyData->email }}"
                            style="color: #666; text-decoration: none;">{{ $companyData->email }}</a>
                    @endif
                </p>
            </div>
        </div>
    </div>
</body>

</html>
