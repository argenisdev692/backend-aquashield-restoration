<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>❌ Solicitud Rechazada - V General Contractors</title>
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

        .social-icons {
            margin: 20px 0;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }

        .highlight-red {
            color: #ef4444;
            font-weight: bold;
        }

        .rejection-banner {
            background: #fee2e2;
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
            background-color: #ef4444;
            color: white;
        }

        .reason-list {
            padding-left: 20px;
            margin-bottom: 20px;
        }

        .reason-list li {
            margin-bottom: 10px;
        }

        .contact-info {
            margin-top: 25px;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #ef4444;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Logo -->
        <div class="logo">
            <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" width="180"
                alt="Logo V General Contractors">
        </div>

        <div class="details">
            <h2 style="color: #ef4444; text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">
                ❌ Información Importante Sobre Su Solicitud
            </h2>

            <div class="rejection-banner">
                <p style="text-align: center; margin: 0;">
                    <strong>Lamentamos informarle que su solicitud ha sido rechazada.</strong>
                </p>
            </div>

            <p style="margin: 20px 0;">Hola <strong>{{ $appointment->first_name }}
                    {{ $appointment->last_name }}</strong>,</p>

            <p>Gracias por su interés en nuestros servicios. Después de revisar su solicitud de inspección,
                lamentamos informarle que actualmente no podemos proceder con su cita por la(s) siguiente(s)
                razón(es):</p>

            <ul class="reason-list">
                @if ($noContact)
                    <li>Hemos intentado contactarle varias veces con respecto a su solicitud de inspección pero no
                        hemos podido comunicarnos con usted. Por favor, si sigue interesado en nuestros servicios,
                        no dude en llamarnos al número que aparece a continuación.</li>
                @endif

                @if ($noInsurance)
                    <li>Nuestros registros indican que su propiedad no cuenta con la cobertura de seguro necesaria
                        para que podamos realizar los servicios de inspección.</li>
                @endif

                @if ($otherReason)
                    <li>{{ $otherReason }}</li>
                @endif
            </ul>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Detalles de la Solicitud:</h3>
                <table style="width: 100%;">
                    <tr>
                        <td><strong>Estado:</strong></td>
                        <td><span class="status-tag">Rechazada</span></td>
                    </tr>
                    <tr>
                        <td><strong>Fecha de Cita:</strong></td>
                        <td>
                            @if ($appointment->inspection_date)
                                @php
                                    $inspectionDate = \Carbon\Carbon::parse($appointment->inspection_date);
                                    $formattedDate = $inspectionDate
                                        ->locale('es')
                                        ->isoFormat('dddd D [de] MMMM [de] YYYY');
                                    echo ucfirst($formattedDate);
                                @endphp
                            @else
                                No especificada
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Dirección:</strong></td>
                        <td>
                            {{ $appointment->address ?? 'No especificada' }}
                            @if ($appointment->address_2)
                                <br>{{ $appointment->address_2 }}
                            @endif
                            @if ($appointment->city)
                                <br>{{ $appointment->city }}, {{ $appointment->state }} {{ $appointment->zipcode }}
                                <br>{{ $appointment->country }}
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div class="contact-info">
                <h4 style="margin-top: 0; color: #2d3748;">¿Necesita más información?</h4>
                <p>Si cree que esta decisión se tomó por error o si sus circunstancias han cambiado, no dude en
                    contactarnos:</p>

                @php
                    $phoneToDisplay = '';
                    if ($companyData->phone) {
                        $digitsOnly = preg_replace('/[^0-9]/', '', $companyData->phone);
                        if (strlen($digitsOnly) == 10) {
                            $phoneToDisplay =
                                '(' .
                                substr($digitsOnly, 0, 3) .
                                ') ' .
                                substr($digitsOnly, 3, 3) .
                                '-' .
                                substr($digitsOnly, 6);
                        } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                            $phoneToDisplay =
                                '(' .
                                substr($digitsOnly, 1, 3) .
                                ') ' .
                                substr($digitsOnly, 4, 3) .
                                '-' .
                                substr($digitsOnly, 7);
                        } else {
                            $phoneToDisplay = $companyData->phone;
                        }
                    }
                @endphp

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
                    <tr>
                        <td align="center">
                            <table cellpadding="0" cellspacing="0" border="0">
                                @if ($companyData->phone)
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td
                                                        style="font-size: 14px; color: #4a5568; vertical-align: middle;">
                                                        📞</td>
                                                    <td style="padding-left: 5px; vertical-align: middle;">
                                                        <a href="tel:{{ $companyData->phone }}"
                                                            style="text-decoration: none; color: #ef4444; font-weight: bold;">{{ $phoneToDisplay }}</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                @endif

                                @if ($companyData->email)
                                    <tr>
                                        <td align="center">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td
                                                        style="font-size: 18px; color: #4a5568; vertical-align: middle;">
                                                        📧</td>
                                                    <td style="padding-left: 10px; vertical-align: middle;">
                                                        <a href="mailto:{{ $companyData->email }}"
                                                            style="text-decoration: none; color: #ef4444; font-weight: bold;">{{ $companyData->email }}</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                @endif
                            </table>
                        </td>
                    </tr>
                </table>
            </div>

            <p>Valoramos su interés en nuestros servicios y estaremos encantados de ayudarle en el futuro si estas
                circunstancias cambian.</p>

            <p>Atentamente,<br>
                El Equipo de {{ $companyData->company_name }}</p>
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
            <p>Horario de atención:<br>
                Lunes a Viernes: 9:00 AM - 5:00 PM</p>
            <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }} {{ $companyData->company_name }}.
                Todos los derechos reservados.</p>
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
